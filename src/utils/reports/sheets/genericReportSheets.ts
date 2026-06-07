import { REPORT_DEFINITIONS } from '../reportDefinitions';
import { dateRangeLabel } from '../dateRangeUtils';
import { fetchReportRows } from '../../../services/reports.service';
import type { ReportConfig, ReportType } from '../../../types/reports.types';
import { resolveColumns, formatCell } from '../reportColumns';

interface SheetsResult {
  rowCount: number;
  sheetsUrl: string;
}

/**
 * Creates a new Google Sheet and writes the report into it using the Sheets
 * REST API directly from the browser. Requires a valid OAuth access token with
 * the spreadsheets scope (obtained via useGoogleSheetsAuth).
 */
export async function exportGenericReportSheets(
  reportType: ReportType,
  companyId: string,
  config: ReportConfig,
  accessToken: string,
): Promise<SheetsResult> {
  const definition = REPORT_DEFINITIONS[reportType];
  const rows = await fetchReportRows(reportType, companyId, config);
  const columns = resolveColumns(reportType, rows);

  const header = columns.map((c) => c.label);
  const dataRows = rows.map((row) => columns.map((c) => formatCell(row[c.key], c.format)));
  const summary = [
    ['Report', definition.name],
    ['Date Range', dateRangeLabel(config.dateFrom, config.dateTo)],
    ['Generated', new Date().toLocaleString()],
    ['Records', rows.length],
  ];

  const title = `PulseMaint — ${definition.name} (${dateRangeLabel(config.dateFrom, config.dateTo)})`;

  // 1. Create the spreadsheet with two sheets.
  const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      properties: { title },
      sheets: [
        { properties: { title: 'Summary' } },
        { properties: { title: 'Detail' } },
      ],
    }),
  });
  if (!createRes.ok) {
    const text = await createRes.text();
    throw new Error(`Google Sheets create failed (${createRes.status}). ${text.slice(0, 160)}`);
  }
  const created = (await createRes.json()) as { spreadsheetId: string; spreadsheetUrl: string };

  // 2. Write both tabs in one batch update.
  const updateRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${created.spreadsheetId}/values:batchUpdate`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        valueInputOption: 'RAW',
        data: [
          { range: 'Summary!A1', values: summary },
          { range: 'Detail!A1', values: [header, ...dataRows] },
        ],
      }),
    },
  );
  if (!updateRes.ok) {
    const text = await updateRes.text();
    throw new Error(`Google Sheets write failed (${updateRes.status}). ${text.slice(0, 160)}`);
  }

  return { rowCount: rows.length, sheetsUrl: created.spreadsheetUrl };
}
