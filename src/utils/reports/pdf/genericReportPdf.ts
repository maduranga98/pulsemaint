import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { collection, getDocs, query, where, limit } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { REPORT_DEFINITIONS } from '../reportDefinitions';
import { dateRangeLabel } from '../dateRangeUtils';
import { fetchReportRows, fetchMachineProfile, type MachineProfileField } from '../../../services/reports.service';
import type { ReportConfig, ReportType } from '../../../types/reports.types';
import { resolveColumns, formatCell } from '../reportColumns';
import type { ReportColumn } from '../reportColumns';
import { renderBarChart, type ChartDatum } from './chartRenderer';
import {
  topHealthScores,
  totalCostByWoType,
  computeStockStatusBuckets,
  downtimeByWeekday,
  lateByBuckets,
} from '../../../lib/reportsCostUtils';

// Columns that make sense as a chart category (a small set of repeated values).
const CATEGORY_KEYS = [
  'severity', 'type', 'status', 'woType', 'priority', 'category',
  'movementType', 'machineDepartment', 'department', 'machineName',
];

/**
 * Picks the best categorical column and returns a frequency distribution for a
 * summary bar chart, or null if nothing suitable is found.
 */
function buildChartData(
  columns: ReportColumn[],
  rows: Record<string, unknown>[],
): { title: string; data: ChartDatum[] } | null {
  const candidates = columns.filter(
    (c) => CATEGORY_KEYS.includes(c.key) && (!c.format || c.format === 'text'),
  );
  for (const col of candidates) {
    const counts = new Map<string, number>();
    rows.forEach((r) => {
      const v = r[col.key];
      if (v == null || v === '') return;
      const key = String(v);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });
    if (counts.size >= 2 && counts.size <= 15) {
      const data = Array.from(counts.entries())
        .map(([label, value]) => ({ label, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 8);
      return { title: `${col.label} distribution`, data };
    }
  }
  return null;
}

/**
 * Builds a frequency distribution of `key` across the rows — used for the
 * report-specific charts (breakdown counts by type / by machine, WO counts).
 */
function countBy(
  rows: Record<string, unknown>[],
  key: string,
  { max = 10 }: { max?: number } = {},
): ChartDatum[] {
  const counts = new Map<string, number>();
  rows.forEach((r) => {
    const v = r[key];
    if (v == null || v === '') return;
    const label = String(v);
    counts.set(label, (counts.get(label) ?? 0) + 1);
  });
  return Array.from(counts.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, max);
}

/**
 * Sums a numeric field across rows, grouped by another field's value — used
 * for the Training Compliance chart (role vs trainings-completed count).
 */
function sumByKey(
  rows: Record<string, unknown>[],
  groupKey: string,
  valueKey: string,
): ChartDatum[] {
  const totals = new Map<string, number>();
  rows.forEach((r) => {
    const group = String(r[groupKey] ?? 'Unknown');
    totals.set(group, (totals.get(group) ?? 0) + Number(r[valueKey] ?? 0));
  });
  return Array.from(totals.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
}

/**
 * Fetches the current inventory parts catalogue's stock-status counts (In
 * Stock / Low Stock / Out of Stock) — used by the Inventory Usage report's
 * chart, which sources its table from stockMovements (not inventoryParts), so
 * the stock-status snapshot needs its own fetch.
 */
async function fetchInventoryStockStatusChart(companyId: string): Promise<ChartDatum[]> {
  const snap = await getDocs(
    query(collection(db, 'inventoryParts'), where('companyId', '==', companyId), limit(2000)),
  );
  const parts = snap.docs.map((d) => d.data());
  return computeStockStatusBuckets(parts as { isLowStock?: boolean; currentStock?: number }[]);
}

/**
 * Builds a PDF for the given report entirely on the client and triggers a
 * download. No Cloud Function required.
 */
export async function exportGenericReportPdf(
  reportType: ReportType,
  companyId: string,
  config: ReportConfig,
): Promise<number> {
  const definition = REPORT_DEFINITIONS[reportType];
  const rows = await fetchReportRows(reportType, companyId, config);

  // Machine History leads with the machine's profile, so pull it up-front.
  const machineProfile =
    reportType === 'machine_history' && config.machines.length === 1
      ? await fetchMachineProfile(config.machines[0])
      : null;

  const landscape = config.orientation === 'landscape';
  const doc = new jsPDF({
    orientation: landscape ? 'landscape' : 'portrait',
    unit: 'pt',
    format: (config.paperSize?.toLowerCase() as 'a4' | 'letter') ?? 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const bottomMargin = 40;

  // Header
  doc.setFontSize(16);
  doc.text(definition.name, 40, 40);
  doc.setFontSize(10);
  doc.setTextColor(120);
  doc.text(`Date range: ${dateRangeLabel(config.dateFrom, config.dateTo)}`, 40, 58);
  doc.text(`Generated: ${new Date().toLocaleString()}  ·  ${rows.length} record(s)`, 40, 72);
  doc.setTextColor(0);

  let cursorY = 90;

  // Renders the machine profile as a two-column key/value block.
  const renderProfile = (profile: MachineProfileField[]) => {
    doc.setFontSize(12);
    doc.text('Machine Profile', 40, cursorY);
    cursorY += 8;
    autoTable(doc, {
      body: profile.map((f) => [f.label, f.value]),
      startY: cursorY,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 3 },
      columnStyles: {
        0: { fontStyle: 'bold', fillColor: [240, 244, 248], cellWidth: 120 },
        1: { cellWidth: 'auto' },
      },
      margin: { left: 40, right: 40 },
    });
    const finalY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY;
    cursorY = (finalY ?? cursorY) + 20;
  };

  // Places a chart image, breaking to a new page first if it wouldn't fit.
  const renderChart = (title: string, data: ChartDatum[], colorByValue = false) => {
    if (data.length === 0) return;
    const dataUrl = renderBarChart(title, data, 900, 420, { colorByValue });
    if (!dataUrl) return;
    const imgW = pageWidth - 80;
    const imgH = imgW * (420 / 900);
    if (cursorY + imgH > pageHeight - bottomMargin) {
      doc.addPage();
      cursorY = 40;
    }
    doc.addImage(dataUrl, 'PNG', 40, cursorY, imgW, imgH);
    cursorY += imgH + 20;
  };

  if (machineProfile && machineProfile.length > 0) {
    renderProfile(machineProfile);
  }

  if (rows.length === 0) {
    doc.setFontSize(12);
    doc.text('No records matched this report configuration.', 40, cursorY + 20);
  } else {
    const allColumns = resolveColumns(reportType, rows);

    // Optional charts. A few reports get purpose-built charts; everything else
    // falls back to the single best-fit categorical distribution.
    if (config.includeCharts) {
      if (reportType === 'breakdown_summary') {
        // Breakdown counts by type.
        renderChart('Breakdown counts by type', countBy(rows, 'type'));
      } else if (reportType === 'machine_history') {
        // Machine History is table/details only — no chart for this report.
      } else if (reportType === 'machine_health_score') {
        // Top 5 healthiest machines only, sorted by health score descending.
        const top5 = topHealthScores(
          rows.map((r) => ({ machineName: String(r.machineName ?? ''), healthScore: Number(r.healthScore ?? 0) })),
          5,
        );
        renderChart('Top 5 Machines by Health Score', top5, true);
      } else if (reportType === 'maintenance_cost') {
        // Total cost summed by WO type.
        renderChart('Total Cost vs WO Type', totalCostByWoType(rows), true);
      } else if (reportType === 'contractor_performance') {
        // Contractor vs Rating.
        const data = rows
          .filter((r) => r.rating != null && r.rating !== '')
          .map((r) => ({ label: String(r.contractorName ?? ''), value: Number(r.rating ?? 0) }));
        renderChart('Contractor vs Rating', data, true);
      } else if (reportType === 'inventory_usage') {
        // Stock-status snapshot of the current parts catalogue (not derived
        // from the movement rows themselves — see fetchInventoryStockStatusChart).
        const data = await fetchInventoryStockStatusChart(companyId);
        renderChart('Stock Status (Low / Out / In Stock)', data, true);
      } else if (reportType === 'inventory_listing') {
        renderChart(
          'Stock Status (Low / Out / In Stock)',
          computeStockStatusBuckets(rows as unknown as { isLowStock?: boolean; currentStock?: number }[]),
          true,
        );
      } else if (reportType === 'low_stock_alert') {
        // Months vs count of low-stock alerts (see lowStockAlertDate
        // enrichment in fetchReportRows).
        const byMonth = new Map<string, number>();
        rows.forEach((r) => {
          const d = r.lowStockAlertDate;
          const date = d && typeof (d as { toDate?: () => Date }).toDate === 'function'
            ? (d as { toDate: () => Date }).toDate()
            : d instanceof Date
              ? d
              : null;
          if (!date) return;
          const key = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
          byMonth.set(key, (byMonth.get(key) ?? 0) + 1);
        });
        const data = Array.from(byMonth.entries()).map(([label, value]) => ({ label, value }));
        renderChart('Low Stock Alerts by Month', data);
      } else if (reportType === 'training_compliance') {
        renderChart('Trainings Completed by Role', sumByKey(rows, 'role', 'trainingsCompleted'), true);
      } else if (reportType === 'shift_handover_summary') {
        const data = lateByBuckets(rows.map((r) => ({ lateMinutes: Number(r.lateByMinutes ?? 0) })));
        renderChart('Late By (count of people)', data, true);
      } else if (reportType === 'downtime_analysis') {
        const data = downtimeByWeekday(
          rows.map((r) => ({
            createdAt: r.createdAt && typeof (r.createdAt as { toDate?: () => Date }).toDate === 'function'
              ? (r.createdAt as { toDate: () => Date }).toDate()
              : null,
            downtimeMinutes: Number(r.downtimeMinutes ?? 0),
          })),
        );
        renderChart('Downtime vs Day of Week', data, true);
      } else if (reportType === 'audit_trail') {
        renderChart('Completed Audits by Category', countBy(rows, 'categoryLabel'));
      } else {
        const chart = buildChartData(allColumns, rows);
        if (chart) renderChart(chart.title, chart.data);
      }
    }

    // Use curated columns; cap how many fit the page width. Work Order Detail
    // is exempt from the cap because its people/date columns are all required —
    // autoTable wraps them to fit rather than dropping them.
    const columnCap = reportType === 'work_order_detail' ? allColumns.length : landscape ? 10 : 7;
    const columns = allColumns.slice(0, columnCap);
    const head = [columns.map((c) => c.label)];
    const body = rows.map((row) => columns.map((c) => String(formatCell(row[c.key], c.format))));

    // Work Order Detail carries every column (no cap above), so it needs a
    // touch smaller text to keep the table from overflowing the page.
    const bodyFontSize = reportType === 'work_order_detail' ? 6 : 7;

    autoTable(doc, {
      head,
      body,
      startY: cursorY,
      styles: { fontSize: bodyFontSize, cellPadding: 3, overflow: 'linebreak' },
      headStyles: { fillColor: [10, 22, 40], textColor: 255 },
      margin: { left: 40, right: 40 },
    });
  }

  const filename = `PulseMaint_${definition.name}_${dateRangeLabel(config.dateFrom, config.dateTo)}.pdf`.replace(
    /[^a-zA-Z0-9_.-]/g,
    '_',
  );
  doc.save(filename);
  return rows.length;
}
