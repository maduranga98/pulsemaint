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
  const rawRows = await fetchReportRows(reportType, companyId, config, t);
  const columns = resolveColumns(reportType, rawRows, t);
  const headers = columns.map((c) => c.label);
  const detail = mapRowsToColumns(columns, rawRows, t);

  const tr = (key: string, defaultValue: string): string => t?.(key, { defaultValue }) ?? defaultValue;
  const metricLabel = tr('common.reports.excel.metric', 'Metric');
  const valueLabel = tr('common.reports.excel.value', 'Value');
  const noDataLabel = tr('common.reports.excel.noData', 'No Data');

  exportToExcel({
    reportName,
    dateRange: dateRangeLabel(config.dateFrom, config.dateTo),
    sheets: [
      {
        name: tr('common.reports.excel.summarySheetName', 'Summary'),
        headers: [metricLabel, valueLabel],
        data: [
          { [metricLabel]: tr('common.reports.excel.reportMetric', 'Report'), [valueLabel]: reportName },
          {
            [metricLabel]: tr('common.reports.excel.dateRangeMetric', 'Date Range'),
            [valueLabel]: tr('common.reports.excel.dateRangeValue', '{{from}} to {{to}}')
              .replace('{{from}}', config.dateFrom)
              .replace('{{to}}', config.dateTo),
          },
          { [metricLabel]: tr('common.reports.excel.rowsMetric', 'Rows'), [valueLabel]: rawRows.length },
        ],
      },
      {
        name: tr('common.reports.excel.detailSheetName', 'Detail'),
        headers: detail.length ? headers : [noDataLabel],
        data: detail.length ? detail : [{ [noDataLabel]: tr('common.reports.pdf.noRecords', 'No records matched this report configuration.') }],
      },
    ],
  });
  return rawRows.length;
}
