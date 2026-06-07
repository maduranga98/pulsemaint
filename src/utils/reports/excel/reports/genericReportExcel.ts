import { REPORT_DEFINITIONS } from '../../reportDefinitions';
import { dateRangeLabel } from '../../dateRangeUtils';
import { fetchReportRows } from '../../../../services/reports.service';
import type { ReportConfig, ReportType } from '../../../../types/reports.types';
import { exportToExcel } from '../excelExporter';
import { resolveColumns, mapRowsToColumns } from '../../reportColumns';

export async function exportGenericReportExcel(
  reportType: ReportType,
  companyId: string,
  config: ReportConfig,
): Promise<number> {
  const definition = REPORT_DEFINITIONS[reportType];
  const rawRows = await fetchReportRows(reportType, companyId, config);
  const columns = resolveColumns(reportType, rawRows);
  const headers = columns.map((c) => c.label);
  const detail = mapRowsToColumns(columns, rawRows);

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
          { Metric: 'Rows', Value: rawRows.length },
        ],
      },
      {
        name: 'Detail',
        headers: detail.length ? headers : ['No Data'],
        data: detail.length ? detail : [{ 'No Data': 'No records matched this report configuration.' }],
      },
    ],
  });
  return rawRows.length;
}
