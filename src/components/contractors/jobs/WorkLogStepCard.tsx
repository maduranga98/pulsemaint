import { useTranslation } from 'react-i18next';
import type { ContractorWorkStep } from '@/lib/contractors/contractorTypes';

interface WorkLogStepCardProps {
  step: ContractorWorkStep;
}

export function WorkLogStepCard({ step }: WorkLogStepCardProps) {
  const { t } = useTranslation();
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{t('common.contractors.jobs.workLog.stepCard.step', { number: step.stepNumber })}</p>
          <p className="mt-1 text-sm text-slate-900">{step.description}</p>
        </div>
        <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">{t('common.contractors.jobs.workLog.stepCard.duration', { minutes: step.durationMinutes })}</span>
      </div>
      {step.photoUrls.length > 0 && (
        <div className="mt-3 flex gap-2 overflow-x-auto">
          {step.photoUrls.map((url) => <img key={url} src={url} alt="" className="h-16 w-16 rounded-md object-cover" />)}
        </div>
      )}
      <p className="mt-3 text-xs text-slate-500">
        {t('common.contractors.jobs.workLog.stepCard.logged', { value: step.loggedAt.toDate().toLocaleString() })}{' '}
        {step.pendingSync ? `- ${t('common.contractors.jobs.workLog.stepCard.pendingSync')}` : ''}
      </p>
    </article>
  );
}

export default WorkLogStepCard;
