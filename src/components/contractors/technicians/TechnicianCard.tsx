import { Edit, Eye, UserRound } from 'lucide-react';
import type { ContractorTechnician } from '@/lib/contractors/contractorTypes';
import ContractorSpecializationTags from '@/components/contractors/registry/ContractorSpecializationTags';

interface TechnicianCardProps {
  technician: ContractorTechnician;
  onView?: (technician: ContractorTechnician) => void;
}

function maskId(value: string) {
  return value.length <= 4 ? value : `****${value.slice(-4)}`;
}

export function TechnicianCard({ technician, onView }: TechnicianCardProps) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        {technician.photoUrl ? (
          <img src={technician.photoUrl} alt="" className="h-14 w-14 rounded-full object-cover" />
        ) : (
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-500">
            <UserRound className="h-7 w-7" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-slate-950">{technician.fullName}</h3>
          <p className="text-xs capitalize text-slate-500">{technician.designation.replace(/_/g, ' ')}</p>
          <span className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${technician.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
            {technician.status}
          </span>
        </div>
      </div>
      <div className="mt-3">
        <ContractorSpecializationTags tags={technician.specialization} limit={3} />
      </div>
      <dl className="mt-3 grid gap-1 text-xs text-slate-600">
        <div>NIC/Passport: <span className="font-mono">{maskId(technician.nicOrPassport)}</span></div>
        <div>Jobs: {technician.jobsAtThisFactory}</div>
        <div>Last visit: {technician.lastVisitedAt ? technician.lastVisitedAt.toDate().toLocaleDateString() : 'Never'}</div>
      </dl>
      <div className="mt-4 flex gap-2">
        <button type="button" onClick={() => onView?.(technician)} className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700">
          <Eye className="h-3.5 w-3.5" />
          View
        </button>
        <button type="button" className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700">
          <Edit className="h-3.5 w-3.5" />
          Edit
        </button>
      </div>
    </article>
  );
}

export default TechnicianCard;
