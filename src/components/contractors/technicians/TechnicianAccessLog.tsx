import type { ContractorJob } from '@/lib/contractors/contractorTypes';

interface TechnicianAccessLogProps {
  jobs: ContractorJob[];
  technicianId?: string;
}

export function TechnicianAccessLog({ jobs, technicianId }: TechnicianAccessLogProps) {
  const visits = technicianId ? jobs.filter((job) => job.technicianIds.includes(technicianId)) : jobs;

  return (
    <div className="space-y-2">
      {visits.length ? visits.map((job) => (
        <div key={job.id} className="rounded-md border border-slate-200 p-3 text-sm">
          <p className="font-semibold text-slate-900">{job.workOrderNumber}</p>
          <p className="text-slate-500">Arrival {job.arrivedAt ? job.arrivedAt.toDate().toLocaleString() : '-'} - Departure {job.departedAt ? job.departedAt.toDate().toLocaleString() : '-'}</p>
        </div>
      )) : <p className="text-sm text-slate-500">No recorded visits.</p>}
    </div>
  );
}

export default TechnicianAccessLog;
