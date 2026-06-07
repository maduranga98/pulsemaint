import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { REPORT_DEFINITIONS } from '../reportDefinitions';
import { dateRangeLabel } from '../dateRangeUtils';
import { fetchReportRows } from '../../../services/reports.service';
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

  const landscape = config.orientation === 'landscape';
  const doc = new jsPDF({
    orientation: landscape ? 'landscape' : 'portrait',
    unit: 'pt',
    format: (config.paperSize?.toLowerCase() as 'a4' | 'letter') ?? 'a4',
  });

  // Header
  doc.setFontSize(16);
  doc.text(definition.name, 40, 40);
  doc.setFontSize(10);
  doc.setTextColor(120);
  doc.text(`Date range: ${dateRangeLabel(config.dateFrom, config.dateTo)}`, 40, 58);
  doc.text(`Generated: ${new Date().toLocaleString()}  ·  ${rows.length} record(s)`, 40, 72);
  doc.setTextColor(0);

  if (rows.length === 0) {
    doc.setFontSize(12);
    doc.text('No records matched this report configuration.', 40, 110);
  } else {
    const allColumns = resolveColumns(reportType, rows);
    let tableStartY = 90;

    // Optional summary chart.
    if (config.includeCharts) {
      const chart = buildChartData(allColumns, rows);
      if (chart) {
        const dataUrl = renderBarChart(chart.title, chart.data);
        if (dataUrl) {
          const pageWidth = doc.internal.pageSize.getWidth();
          const imgW = pageWidth - 80;
          const imgH = imgW * (420 / 900);
          doc.addImage(dataUrl, 'PNG', 40, tableStartY, imgW, imgH);
          tableStartY += imgH + 20;
        }
      }
    }

    // Use curated columns; cap how many fit the page width.
    const columns = allColumns.slice(0, landscape ? 10 : 7);
    const head = [columns.map((c) => c.label)];
    const body = rows.map((row) => columns.map((c) => String(formatCell(row[c.key], c.format))));

    autoTable(doc, {
      head,
      body,
      startY: tableStartY,
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
