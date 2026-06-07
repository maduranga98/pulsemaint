import { REPORT_DEFINITIONS } from '../reportDefinitions';
import { dateRangeLabel } from '../dateRangeUtils';
import { fetchReportRows } from '../../../services/reports.service';
import type { ReportConfig, ReportType } from '../../../types/reports.types';
import { resolveColumns, formatCell } from '../reportColumns';

function escapeCsv(value: string | number): string {
  const str = String(value ?? '');
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

/**
 * Builds a CSV for the report and triggers a download. Used as a fallback when
 * Google Sheets is not connected — the file imports cleanly into Sheets/Excel.
 */
export async function exportGenericReportCsv(
  reportType: ReportType,
  companyId: string,
  config: ReportConfig,
): Promise<number> {
  const definition = REPORT_DEFINITIONS[reportType];
  const rows = await fetchReportRows(reportType, companyId, config);
  const columns = resolveColumns(reportType, rows);

  const lines: string[] = [];
  lines.push(columns.map((c) => escapeCsv(c.label)).join(','));
  rows.forEach((row) => {
    lines.push(columns.map((c) => escapeCsv(formatCell(row[c.key], c.format))).join(','));
  });

  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const filename = `PulseMaint_${definition.name}_${dateRangeLabel(config.dateFrom, config.dateTo)}.csv`.replace(
    /[^a-zA-Z0-9_.-]/g,
    '_',
  );
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return rows.length;
}
