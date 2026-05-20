import { Clock, MapPin } from 'lucide-react';
import type { ContractorJob } from '@/lib/contractors/contractorTypes';
import { useContractorAccess } from '@/hooks/contractors/useContractorAccess';

interface ArrivalLogSectionProps {
  job: ContractorJob;
}

export function ArrivalLogSection({ job }: ArrivalLogSectionProps) {
  const access = useContractorAccess();
  const arrived = Boolean(job.arrivedAt);
  const departed = Boolean(job.departedAt);

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="font-semibold text-slate-950">Arrival & Departure</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-md bg-slate-50 p-3 text-sm text-slate-700">
          <MapPin className="mb-2 h-4 w-4 text-blue-600" />
          Arrival: {job.arrivedAt ? job.arrivedAt.toDate().toLocaleString() : 'Not arrived'}
        </div>
        <div className="rounded-md bg-slate-50 p-3 text-sm text-slate-700">
          <Clock className="mb-2 h-4 w-4 text-blue-600" />
          Departure: {job.departedAt ? job.departedAt.toDate().toLocaleString() : 'Not departed'}
        </div>
      </div>
      {access.canLogContractorWork && (
        <div className="mt-4 flex flex-wrap gap-2">
          {!arrived && <button type="button" className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white">Log Contractor Arrival</button>}
          {arrived && !departed && <button type="button" className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Log Departure</button>}
        </div>
      )}
    </section>
  );
}

export default ArrivalLogSection;
