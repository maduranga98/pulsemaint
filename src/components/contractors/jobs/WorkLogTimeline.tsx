import { useTranslation } from 'react-i18next';
import type { ContractorWorkStep } from '@/lib/contractors/contractorTypes';
import WorkLogStepCard from './WorkLogStepCard';

interface WorkLogTimelineProps {
  steps: ContractorWorkStep[];
}

export function WorkLogTimeline({ steps }: WorkLogTimelineProps) {
  const { t } = useTranslation();
  return (
    <section className="space-y-3">
      <h2 className="font-semibold text-slate-950">{t('common.contractors.jobs.workLog.timeline.title')}</h2>
      {steps.length ? [...steps].sort((a, b) => b.stepNumber - a.stepNumber).map((step) => (
        <WorkLogStepCard key={step.id} step={step} />
      )) : (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">{t('common.contractors.jobs.workLog.timeline.empty')}</div>
      )}
    </section>
  );
}

export default WorkLogTimeline;
