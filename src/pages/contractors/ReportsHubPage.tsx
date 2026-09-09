import { FileSpreadsheet, FileText } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const REPORT_KEYS = [
  'performance',
  'invoiceComparison',
  'jobHistory',
  'rating',
  'documentCompliance',
] as const;

export function ReportsHubPage() {
  const { t } = useTranslation();
  return (
    <div className="space-y-5 p-4 lg:p-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-950">{t('common.contractors.reportsHubPage.title')}</h1>
        <p className="mt-1 text-sm text-slate-500">{t('common.contractors.reportsHubPage.subtitle')}</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {REPORT_KEYS.map((key) => (
          <article key={key} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="font-semibold text-slate-950">{t(`common.contractors.reportsHubPage.reports.${key}.title`)}</h2>
            <p className="mt-1 text-sm text-slate-500">{t(`common.contractors.reportsHubPage.reports.${key}.description`)}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-xs font-semibold text-white"><FileText className="h-3.5 w-3.5" />{t('common.contractors.reportsHubPage.actions.generatePdf')}</button>
              <button type="button" className="inline-flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700"><FileSpreadsheet className="h-3.5 w-3.5" />{t('common.contractors.reportsHubPage.actions.exportExcel')}</button>
              <button type="button" className="rounded-md border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700">{t('common.contractors.reportsHubPage.actions.pushToSheets')}</button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

export default ReportsHubPage;
