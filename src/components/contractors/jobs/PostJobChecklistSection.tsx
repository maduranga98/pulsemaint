import type { ContractorJob } from '@/lib/contractors/contractorTypes';

interface PostJobChecklistSectionProps {
  job: ContractorJob;
}

export function PostJobChecklistSection({ job }: PostJobChecklistSectionProps) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="font-semibold text-slate-950">Post-Job Checklist</h2>
      <div className="mt-4 space-y-2">
        {job.checklistResults.length ? job.checklistResults.map((item) => (
          <div key={item.step} className="rounded-md border border-slate-200 p-3 text-sm">
            <span className={item.passed ? 'font-semibold text-emerald-700' : 'font-semibold text-red-700'}>{item.passed ? 'Pass' : 'Fail'}</span>
            <span className="ml-2 text-slate-800">{item.step}</span>
            {item.notes && <p className="mt-1 text-xs text-slate-500">{item.notes}</p>}
          </div>
        )) : <p className="text-sm text-slate-500">Checklist not completed yet.</p>}
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-md bg-slate-50 p-3 text-sm">Test run: <span className="font-semibold capitalize">{job.testRunResult ?? '-'}</span></div>
        <div className="rounded-md bg-slate-50 p-3 text-sm">Machine after: <span className="font-semibold capitalize">{job.machineStatusAfter?.replace(/_/g, ' ') ?? '-'}</span></div>
      </div>
    </section>
  );
}

export default PostJobChecklistSection;
