import { useTranslation } from 'react-i18next';
import type { ContractorJob } from '@/lib/contractors/contractorTypes';

interface PostJobChecklistSectionProps {
  job: ContractorJob;
}

export function PostJobChecklistSection({ job }: PostJobChecklistSectionProps) {
  const { t } = useTranslation();
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="font-semibold text-slate-950">{t('common.contractors.jobs.checklist.title')}</h2>
      <div className="mt-4 space-y-2">
        {job.checklistResults.length ? job.checklistResults.map((item) => (
          <div key={item.step} className="rounded-md border border-slate-200 p-3 text-sm">
            <span className={item.passed ? 'font-semibold text-emerald-700' : 'font-semibold text-red-700'}>
              {item.passed ? t('common.contractors.jobs.checklist.pass') : t('common.contractors.jobs.checklist.fail')}
            </span>
            <span className="ml-2 text-slate-800">{item.step}</span>
            {item.notes && <p className="mt-1 text-xs text-slate-500">{item.notes}</p>}
          </div>
        )) : <p className="text-sm text-slate-500">{t('common.contractors.jobs.checklist.empty')}</p>}
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-md bg-slate-50 p-3 text-sm">{t('common.contractors.jobs.checklist.testRun', { value: job.testRunResult ?? '-' })}</div>
        <div className="rounded-md bg-slate-50 p-3 text-sm">{t('common.contractors.jobs.checklist.machineAfter', { value: job.machineStatusAfter?.replace(/_/g, ' ') ?? '-' })}</div>
      </div>
    </section>
  );
}

export default PostJobChecklistSection;
