import { Link } from 'react-router-dom';
import type { ContractorJob } from '@/lib/contractors/contractorTypes';
import ContractorJobStatusBadge from './ContractorJobStatusBadge';

interface ContractorJobHeaderProps {
  job: ContractorJob;
}

export function ContractorJobHeader({ job }: ContractorJobHeaderProps) {
  return (
    <header className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Link to={`/app/work-orders/${job.workOrderId}`} className="text-2xl font-bold text-blue-700">{job.workOrderNumber}</Link>
            <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">{job.workOrderType}</span>
            <span className="rounded-full bg-red-50 px-2 py-1 text-xs font-semibold capitalize text-red-700">{job.priority}</span>
          </div>
          <p className="mt-2 text-sm text-slate-600">
            <Link to={`/app/contractors/${job.contractorId}`} className="font-semibold text-slate-950">{job.contractorName}</Link> - {job.machineName} - {job.machineLocation}
          </p>
          <p className="mt-1 text-xs text-slate-500">SLA deadline: {job.slaDeadline ? job.slaDeadline.toDate().toLocaleString() : '-'}</p>
        </div>
        <ContractorJobStatusBadge status={job.status} />
      </div>
    </header>
  );
}

export default ContractorJobHeader;
