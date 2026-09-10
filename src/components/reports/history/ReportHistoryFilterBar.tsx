import { useTranslation } from 'react-i18next';
import { REPORT_LIST, getReportName } from '../../../utils/reports/reportDefinitions';
import type { ReportHistoryFilters } from '../../../types/reports.types';

export default function ReportHistoryFilterBar({
  filters,
  onChange,
}: {
  filters: ReportHistoryFilters;
  onChange: (updates: Partial<ReportHistoryFilters>) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="grid gap-3 rounded-lg border border-[#1E3A5F] bg-[#0F1E35] p-4 sm:grid-cols-2 lg:grid-cols-5">
      <select value={filters.reportType} onChange={(event) => onChange({ reportType: event.target.value as ReportHistoryFilters['reportType'] })} className="h-11 rounded-lg border border-[#1E3A5F] bg-[#0A1628] px-3 text-sm text-[#F0F4F8]">
        <option value="all">{t('common.reports.history.filterBar.allReports')}</option>
        {REPORT_LIST.map((report) => (
          <option key={report.type} value={report.type}>{getReportName(report, t)}</option>
        ))}
      </select>
      <select value={filters.format} onChange={(event) => onChange({ format: event.target.value as ReportHistoryFilters['format'] })} className="h-11 rounded-lg border border-[#1E3A5F] bg-[#0A1628] px-3 text-sm text-[#F0F4F8]">
        <option value="all">{t('common.reports.history.filterBar.allFormats')}</option>
        <option value="pdf">{t('common.reports.history.filterBar.pdf')}</option>
        <option value="excel">{t('common.reports.history.filterBar.excel')}</option>
        <option value="google_sheets">{t('common.reports.history.filterBar.sheets')}</option>
      </select>
      <input value={filters.generatedBy} onChange={(event) => onChange({ generatedBy: event.target.value })} placeholder={t('common.reports.history.filterBar.generatedByPlaceholder')} className="h-11 rounded-lg border border-[#1E3A5F] bg-[#0A1628] px-3 text-sm text-[#F0F4F8]" />
      <input type="date" value={filters.dateFrom} onChange={(event) => onChange({ dateFrom: event.target.value })} className="h-11 rounded-lg border border-[#1E3A5F] bg-[#0A1628] px-3 text-sm text-[#F0F4F8]" />
      <input type="date" value={filters.dateTo} onChange={(event) => onChange({ dateTo: event.target.value })} className="h-11 rounded-lg border border-[#1E3A5F] bg-[#0A1628] px-3 text-sm text-[#F0F4F8]" />
    </div>
  );
}
