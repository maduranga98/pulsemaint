import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { REPORT_DEFINITIONS } from '../reportDefinitions';
import { dateRangeLabel } from '../dateRangeUtils';
import { fetchReportRows, fetchMachineProfile, type MachineProfileField } from '../../../services/reports.service';
import type { ReportConfig, ReportType } from '../../../types/reports.types';
import { resolveColumns, formatCell } from '../reportColumns';
import type { ReportColumn } from '../reportColumns';
import { renderBarChart, type ChartDatum } from './chartRenderer';

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
        // Breakdown counts by type and by machine.
        renderChart('Breakdown counts by type', countBy(rows, 'type'));
        renderChart('Breakdown counts by machine', countBy(rows, 'machineName'));
      } else if (reportType === 'machine_history') {
        // Work-order counts for this machine, coloured by count magnitude.
        renderChart('Work order counts by type', countBy(rows, 'woType'), true);
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

    autoTable(doc, {
      head,
      body,
      startY: cursorY,
      styles: { fontSize: 7, cellPadding: 3, overflow: 'linebreak' },
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
