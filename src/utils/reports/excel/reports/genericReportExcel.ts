import { REPORT_DEFINITIONS } from '../../reportDefinitions';
import { dateRangeLabel } from '../../dateRangeUtils';
import { fetchReportRows } from '../../../../services/reports.service';
import type { ReportConfig, ReportType } from '../../../../types/reports.types';
import { exportToExcel } from '../excelExporter';

const titleCase = (value: string) =>
  value
    .replace(/([A-Z])/g, ' $1')
    .replace(/[_-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (match) => match.toUpperCase());

function flattenRows(rows: Record<string, unknown>[]): Record<string, unknown>[] {
  return rows.map((row) => {
    const output: Record<string, unknown> = {};
    Object.entries(row).forEach(([key, value]) => {
      if (value && typeof value === 'object') {
        if ('seconds' in value) output[titleCase(key)] = new Date(Number(value.seconds) * 1000).toISOString();
        else output[titleCase(key)] = JSON.stringify(value);
      } else {
        output[titleCase(key)] = value ?? '';
      }
    });
    return output;
  });
}

export async function exportGenericReportExcel(
  reportType: ReportType,
  companyId: string,
  config: ReportConfig,
): Promise<number> {
  const definition = REPORT_DEFINITIONS[reportType];
  const rows = flattenRows(await fetchReportRows(reportType, companyId, config));
  const headers = rows[0] ? Object.keys(rows[0]) : ['No Data'];
  exportToExcel({
    reportName: definition.name,
    dateRange: dateRangeLabel(config.dateFrom, config.dateTo),
    sheets: [
      {
        name: 'Summary',
        headers: ['Metric', 'Value'],
        data: [
          { Metric: 'Report', Value: definition.name },
          { Metric: 'Date Range', Value: `${config.dateFrom} to ${config.dateTo}` },
          { Metric: 'Rows', Value: rows.length },
        ],
      },
      {
        name: 'Detail',
        headers,
        data: rows.length ? rows : [{ 'No Data': 'No records matched this report configuration.' }],
      },
    ],
  });
  return rows.length;
}
