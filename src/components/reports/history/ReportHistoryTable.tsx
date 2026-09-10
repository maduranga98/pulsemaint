import { useTranslation } from 'react-i18next';
import { Download, Link2, Trash2 } from 'lucide-react';
import ReportFormatBadge from './ReportFormatBadge';
import type { ReportHistory } from '../../../types/reports.types';

export default function ReportHistoryTable({
  reports,
  onDelete,
}: {
  reports: ReportHistory[];
  onDelete?: (id: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="hidden overflow-hidden rounded-lg border border-[#1E3A5F] bg-[#0F1E35] lg:block">
      <table className="w-full text-left text-sm">
        <thead className="bg-[#0A1628] text-xs uppercase text-[#8BA3BF]">
          <tr>
            <th className="px-4 py-3">{t('common.reports.history.table.columns.reportName')}</th>
            <th className="px-4 py-3">{t('common.reports.history.table.columns.format')}</th>
            <th className="px-4 py-3">{t('common.reports.history.table.columns.generatedBy')}</th>
            <th className="px-4 py-3">{t('common.reports.history.table.columns.dateTime')}</th>
            <th className="px-4 py-3">{t('common.reports.history.table.columns.dateRange')}</th>
            <th className="px-4 py-3">{t('common.reports.history.table.columns.fileSize')}</th>
            <th className="px-4 py-3">{t('common.reports.history.table.columns.actions')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#1E3A5F] text-[#F0F4F8]">
          {reports.map((report) => (
            <tr key={report.id}>
              <td className="px-4 py-3 font-medium">{report.reportName}</td>
              <td className="px-4 py-3"><ReportFormatBadge format={report.format} /></td>
              <td className="px-4 py-3 text-[#8BA3BF]">{report.generatedByName}</td>
              <td className="px-4 py-3 text-[#8BA3BF]">{report.generatedAt.toLocaleString()}</td>
              <td className="px-4 py-3 text-[#8BA3BF]">{t('common.reports.history.table.dateRangeValue', { from: report.dateRangeFrom, to: report.dateRangeTo })}</td>
              <td className="px-4 py-3 text-[#8BA3BF]">{report.fileSizeBytes ? t('common.reports.history.table.fileSizeMb', { size: (report.fileSizeBytes / 1024 / 1024).toFixed(1) }) : t('common.reports.history.table.noFileSize')}</td>
              <td className="px-4 py-3">
                <div className="flex gap-1">
                  <a href={report.downloadUrl ?? report.googleSheetsUrl ?? '#'} target="_blank" rel="noreferrer" className="flex h-10 w-10 items-center justify-center rounded-lg text-[#8BA3BF] hover:bg-[#0A1628] hover:text-[#F0F4F8]" aria-label={t('common.reports.history.table.downloadAriaLabel')}>
                    <Download className="h-4 w-4" />
                  </a>
                  <button type="button" onClick={() => void navigator.clipboard.writeText(report.downloadUrl ?? report.googleSheetsUrl ?? '')} className="flex h-10 w-10 items-center justify-center rounded-lg text-[#8BA3BF] hover:bg-[#0A1628] hover:text-[#F0F4F8]" aria-label={t('common.reports.history.table.copyLinkAriaLabel')}>
                    <Link2 className="h-4 w-4" />
                  </button>
                  {onDelete && (
                    <button type="button" onClick={() => onDelete(report.id)} className="flex h-10 w-10 items-center justify-center rounded-lg text-[#FCA5A5] hover:bg-[#EF4444]/10" aria-label={t('common.reports.history.table.deleteAriaLabel')}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
