import { Camera, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export function WorkLogEntryForm() {
  const { t } = useTranslation();
  return (
    <form className="rounded-lg border border-slate-200 bg-white p-4">
      <h3 className="font-semibold text-slate-950">{t('common.contractors.jobs.workLog.entryForm.title')}</h3>
      <textarea placeholder={t('common.contractors.jobs.workLog.entryForm.descriptionPlaceholder')} className="mt-3 min-h-28 w-full rounded-md border border-slate-200 px-3 py-2 text-sm" />
      <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_160px]">
        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-slate-300 bg-slate-50 px-3 py-3 text-sm font-medium text-slate-600">
          <Camera className="h-4 w-4 text-blue-600" />
          {t('common.contractors.jobs.workLog.entryForm.addPhotos')}
          <input type="file" accept="image/*" multiple className="hidden" />
        </label>
        <input type="number" min={1} placeholder={t('common.contractors.jobs.workLog.entryForm.durationPlaceholder')} className="h-11 rounded-md border border-slate-200 px-3 text-sm" />
      </div>
      <button type="button" className="mt-3 inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white">
        <Plus className="h-4 w-4" />
        {t('common.contractors.jobs.workLog.entryForm.addStep')}
      </button>
    </form>
  );
}

export default WorkLogEntryForm;
