import { useTranslation } from 'react-i18next';
import type { ReportConfig, ReportType } from '../../../types/reports.types';

export default function PdfOptionsSection({
  config,
  onChange,
  reportType,
}: {
  config: ReportConfig;
  onChange: (updates: Partial<ReportConfig>) => void;
  reportType?: ReportType | null;
}) {
  const { t } = useTranslation();
  if (config.outputFormat !== 'pdf') return null;

  // Machine History is table-only (no graphical/chart view at all — see
  // genericReportPdf.ts) so there is no "include charts" choice to offer.
  const supportsCharts = reportType !== 'machine_history';

  return (
    <section className="space-y-3 border-b border-[#1E3A5F] pb-5">
      <h3 className=" text-sm font-semibold text-[#F0F4F8]">{t('common.reports.config.pdfOptionsSection.title')}</h3>
      {supportsCharts && (
        <label className="flex min-h-11 items-center justify-between rounded-lg border border-[#1E3A5F] bg-[#0A1628] px-3 text-sm text-[#F0F4F8]">
          {t('common.reports.config.pdfOptionsSection.includeCharts')}
          <input type="checkbox" checked={config.includeCharts} onChange={(event) => onChange({ includeCharts: event.target.checked })} className="h-4 w-4 accent-[#1A56DB]" />
        </label>
      )}
      <label className="flex min-h-11 items-center justify-between rounded-lg border border-[#1E3A5F] bg-[#0A1628] px-3 text-sm text-[#F0F4F8]">
        {t('common.reports.config.pdfOptionsSection.includeDataTable')}
        <input type="checkbox" checked={config.includeDataTable} onChange={(event) => onChange({ includeDataTable: event.target.checked })} className="h-4 w-4 accent-[#1A56DB]" />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="space-y-1 text-xs text-[#8BA3BF]">
          {t('common.reports.config.pdfOptionsSection.paperSize')}
          <select value={config.paperSize} onChange={(event) => onChange({ paperSize: event.target.value as ReportConfig['paperSize'] })} className="h-11 w-full rounded-lg border border-[#1E3A5F] bg-[#0A1628] px-3 text-sm text-[#F0F4F8]">
            <option>A4</option>
            <option>Letter</option>
          </select>
        </label>
        <label className="space-y-1 text-xs text-[#8BA3BF]">
          {t('common.reports.config.pdfOptionsSection.orientation')}
          <select value={config.orientation} onChange={(event) => onChange({ orientation: event.target.value as ReportConfig['orientation'] })} className="h-11 w-full rounded-lg border border-[#1E3A5F] bg-[#0A1628] px-3 text-sm text-[#F0F4F8]">
            <option value="portrait">{t('common.reports.config.pdfOptionsSection.portrait')}</option>
            <option value="landscape">{t('common.reports.config.pdfOptionsSection.landscape')}</option>
          </select>
        </label>
      </div>
    </section>
  );
}
