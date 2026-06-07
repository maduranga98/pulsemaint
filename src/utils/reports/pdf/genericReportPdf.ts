import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { REPORT_DEFINITIONS } from '../reportDefinitions';
import { dateRangeLabel } from '../dateRangeUtils';
import { fetchReportRows } from '../../../services/reports.service';
import type { ReportConfig, ReportType } from '../../../types/reports.types';

const titleCase = (value: string) =>
  value
    .replace(/([A-Z])/g, ' $1')
    .replace(/[_-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (match) => match.toUpperCase());

function cellValue(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'object') {
    if ('seconds' in (value as Record<string, unknown>)) {
      return new Date(Number((value as { seconds: number }).seconds) * 1000).toLocaleString();
    }
    return JSON.stringify(value);
  }
  return String(value);
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
    // Limit columns to keep the table readable; prioritise the first keys.
    const allKeys = Object.keys(rows[0]).filter((k) => k !== 'id');
    const keys = allKeys.slice(0, landscape ? 10 : 7);
    const head = [keys.map((k) => titleCase(k))];
    const body = rows.map((row) => keys.map((k) => cellValue(row[k])));

    autoTable(doc, {
      head,
      body,
      startY: 90,
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
