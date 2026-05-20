import type { ContractorWorkStep } from '@/lib/contractors/contractorTypes';
import WorkLogStepCard from './WorkLogStepCard';

interface WorkLogTimelineProps {
  steps: ContractorWorkStep[];
}

export function WorkLogTimeline({ steps }: WorkLogTimelineProps) {
  return (
    <section className="space-y-3">
      <h2 className="font-semibold text-slate-950">Work Log</h2>
      {steps.length ? [...steps].sort((a, b) => b.stepNumber - a.stepNumber).map((step) => (
        <WorkLogStepCard key={step.id} step={step} />
      )) : (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">No work steps logged yet.</div>
      )}
    </section>
  );
}

export default WorkLogTimeline;
