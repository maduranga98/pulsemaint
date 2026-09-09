import { Upload } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export function InvoiceUploadSection() {
  const { t } = useTranslation();
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="font-semibold text-slate-950">{t('common.contractors.jobs.invoiceUpload.title')}</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <input placeholder={t('common.contractors.jobs.invoiceUpload.referencePlaceholder')} className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
        <input type="date" className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
        <input type="number" placeholder={t('common.contractors.jobs.invoiceUpload.amountPlaceholder')} className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
      </div>
      <label className="mt-3 flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-6 text-sm font-medium text-slate-600">
        <Upload className="h-4 w-4 text-blue-600" />
        {t('common.contractors.jobs.invoiceUpload.uploadPdf')}
        <input type="file" accept="application/pdf" className="hidden" />
      </label>
    </section>
  );
}

export default InvoiceUploadSection;
