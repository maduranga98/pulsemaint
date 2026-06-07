import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { REPORT_DEFINITIONS } from '../reportDefinitions';
import { dateRangeLabel } from '../dateRangeUtils';
import { fetchReportRows } from '../../../services/reports.service';
import type { ReportConfig, ReportType } from '../../../types/reports.types';
import { resolveColumns, formatCell } from '../reportColumns';

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
    // Use curated columns; cap how many fit the page width.
    const columns = resolveColumns(reportType, rows).slice(0, landscape ? 10 : 7);
    const head = [columns.map((c) => c.label)];
    const body = rows.map((row) => columns.map((c) => String(formatCell(row[c.key], c.format))));

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
