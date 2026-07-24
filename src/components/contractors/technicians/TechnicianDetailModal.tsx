import { UserRound } from 'lucide-react';
import type { ContractorTechnician } from '@/lib/contractors/contractorTypes';
import { SPECIALIZATION_LABELS } from '@/lib/contractors/contractorTypes';

interface TechnicianDetailModalProps {
  technician: ContractorTechnician | null;
  onClose: () => void;
}

export function TechnicianDetailModal({ technician, onClose }: TechnicianDetailModalProps) {
  if (!technician) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-slate-950/40 p-4 sm:items-center sm:justify-center">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white p-4 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            {technician.photoUrl ? (
              <img src={technician.photoUrl} alt="" className="h-14 w-14 rounded-full object-cover" />
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                <UserRound className="h-7 w-7" />
              </div>
            )}
            <div>
              <h2 className="text-lg font-semibold text-slate-950">{technician.fullName}</h2>
              <p className="text-sm capitalize text-slate-500">{technician.designation.replace(/_/g, ' ')}</p>
              <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${technician.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                {technician.status}
              </span>
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-sm font-semibold text-slate-500">Close</button>
        </div>

        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div><dt className="text-slate-400">NIC/Passport</dt><dd className="font-mono text-slate-900">{technician.nicOrPassport}</dd></div>
          <div><dt className="text-slate-400">Contractor</dt><dd className="text-slate-900">{technician.contractorName || '-'}</dd></div>
          <div><dt className="text-slate-400">Phone</dt><dd className="text-slate-900">{technician.phone || '-'}</dd></div>
          <div><dt className="text-slate-400">Email</dt><dd className="text-slate-900">{technician.email || '-'}</dd></div>
          <div><dt className="text-slate-400">Jobs at this factory</dt><dd className="text-slate-900">{technician.jobsAtThisFactory}</dd></div>
          <div><dt className="text-slate-400">Last visit</dt><dd className="text-slate-900">{technician.lastVisitedAt ? technician.lastVisitedAt.toDate().toLocaleDateString() : 'Never'}</dd></div>
        </dl>

        <div className="mt-4 text-sm">
          <dt className="text-slate-400">Specialization</dt>
          <dd className="mt-1 flex flex-wrap gap-1.5">
            {technician.specialization.length ? technician.specialization.map((tag) => (
              <span key={tag} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
                {SPECIALIZATION_LABELS[tag] ?? tag}
              </span>
            )) : <span className="text-slate-900">-</span>}
          </dd>
        </div>

        <div className="mt-4 text-sm">
          <dt className="text-slate-400">Certifications</dt>
          <dd className="text-slate-900">{technician.certifications.join(', ') || '-'}</dd>
        </div>
      </div>
    </div>
  );
}

export default TechnicianDetailModal;
