import type { ContractorJob } from '@/lib/contractors/contractorTypes';
import SignaturePad from './SignaturePad';

interface SignOffFormProps {
  job: ContractorJob;
}

export function SignOffForm({ job }: SignOffFormProps) {
  return (
    <form className="space-y-4">
      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="font-semibold text-slate-950">Review Summary</h2>
        <textarea defaultValue={job.workDoneDescription} placeholder="Work done description" className="mt-3 min-h-28 w-full rounded-md border border-slate-200 px-3 py-2 text-sm" />
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <select className="h-10 rounded-md border border-slate-200 px-3 text-sm">
            <option>Wear</option>
            <option>Operator Error</option>
            <option>Defect</option>
            <option>Lack of PM</option>
            <option>External</option>
            <option>Unknown</option>
          </select>
          <select className="h-10 rounded-md border border-slate-200 px-3 text-sm">
            <option>Operational</option>
            <option>Partially Operational</option>
            <option>Still Down</option>
          </select>
        </div>
      </section>
      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="font-semibold text-slate-950">Digital Signature</h2>
        <div className="mt-3"><SignaturePad /></div>
      </section>
      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <label className="flex items-center gap-2 text-sm font-medium text-slate-800">
          <input type="checkbox" />
          I have concerns about the quality of this work
        </label>
        <textarea placeholder="Sign-off notes or dispute notes" className="mt-3 min-h-24 w-full rounded-md border border-slate-200 px-3 py-2 text-sm" />
        <button type="button" className="mt-3 w-full rounded-md bg-emerald-600 px-4 py-3 text-sm font-semibold text-white sm:w-auto">Sign Off & Complete</button>
      </section>
    </form>
  );
}

export default SignOffForm;
