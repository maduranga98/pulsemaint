import { Link } from 'react-router-dom';
import type { ContractorJob } from '@/lib/contractors/contractorTypes';
import ContractorJobStatusBadge from './ContractorJobStatusBadge';

interface ContractorJobCardProps {
  job: ContractorJob;
}

export function ContractorJobCard({ job }: ContractorJobCardProps) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-slate-950">{job.workOrderNumber}</h3>
          <p className="text-sm text-slate-600">{job.contractorName}</p>
        </div>
        <span className="rounded-full bg-red-50 px-2 py-1 text-xs font-semibold capitalize text-red-700">{job.priority}</span>
      </div>
      <p className="mt-3 text-sm text-slate-700">{job.machineName}</p>
      <p className="text-xs text-slate-500">{job.machineLocation}</p>
      <div className="mt-4 flex items-center justify-between gap-3">
        <ContractorJobStatusBadge status={job.status} />
        <Link to={`/app/contractors/jobs/${job.id}`} className="rounded-md bg-blue-600 px-3 py-2 text-xs font-semibold text-white">View Job</Link>
      </div>
    </article>
  );
}

export default ContractorJobCard;
