import { useTranslation } from 'react-i18next';
import type { ContractorJob } from '@/lib/contractors/contractorTypes';

interface TechnicianAccessLogProps {
  jobs: ContractorJob[];
  technicianId?: string;
}

export function TechnicianAccessLog({ jobs, technicianId }: TechnicianAccessLogProps) {
  const { t } = useTranslation();
  const visits = technicianId ? jobs.filter((job) => job.technicianIds.includes(technicianId)) : jobs;
  const notRecorded = t('common.contractors.technicians.accessLog.notRecorded');

  return (
    <div className="space-y-2">
      {visits.length ? visits.map((job) => (
        <div key={job.id} className="rounded-md border border-slate-200 p-3 text-sm">
          <p className="font-semibold text-slate-900">{job.workOrderNumber}</p>
          <p className="text-slate-500">
            {t('common.contractors.technicians.accessLog.arrivalDeparture', {
              arrival: job.arrivedAt ? job.arrivedAt.toDate().toLocaleString() : notRecorded,
              departure: job.departedAt ? job.departedAt.toDate().toLocaleString() : notRecorded,
            })}
          </p>
        </div>
      )) : <p className="text-sm text-slate-500">{t('common.contractors.technicians.accessLog.empty')}</p>}
    </div>
  );
}

export default TechnicianAccessLog;
