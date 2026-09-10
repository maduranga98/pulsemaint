import type { TFunction } from 'i18next';
import { REPORT_DEFINITIONS, getReportName } from '../../reportDefinitions';
import { dateRangeLabel } from '../../dateRangeUtils';
import { fetchReportRows } from '../../../../services/reports.service';
import type { ReportConfig, ReportType } from '../../../../types/reports.types';
import { exportToExcel } from '../excelExporter';
import { resolveColumns, mapRowsToColumns } from '../../reportColumns';

export async function exportGenericReportExcel(
  reportType: ReportType,
  companyId: string,
  config: ReportConfig,
  t?: TFunction,
): Promise<number> {
  const definition = REPORT_DEFINITIONS[reportType];
  const reportName = getReportName(definition, t);
  const rawRows = await fetchReportRows(reportType, companyId, config);
  const columns = resolveColumns(reportType, rawRows, t);
  const headers = columns.map((c) => c.label);
  const detail = mapRowsToColumns(columns, rawRows);

  exportToExcel({
    reportName,
    dateRange: dateRangeLabel(config.dateFrom, config.dateTo),
    sheets: [
      {
        name: 'Summary',
        headers: ['Metric', 'Value'],
        data: [
          { Metric: 'Report', Value: reportName },
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
