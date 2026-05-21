import type { ContractorTechnician } from '@/lib/contractors/contractorTypes';

interface TechnicianDetailModalProps {
  technician: ContractorTechnician | null;
  onClose: () => void;
}

export function TechnicianDetailModal({ technician, onClose }: TechnicianDetailModalProps) {
  if (!technician) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-slate-950/40 p-4 sm:items-center sm:justify-center">
      <div className="w-full max-w-lg rounded-lg bg-white p-4 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">{technician.fullName}</h2>
            <p className="text-sm capitalize text-slate-500">{technician.designation.replace(/_/g, ' ')}</p>
          </div>
          <button type="button" onClick={onClose} className="text-sm font-semibold text-slate-500">Close</button>
        </div>
        <dl className="mt-4 grid gap-3 text-sm">
          <div><dt className="text-slate-400">NIC/Passport</dt><dd className="font-mono text-slate-900">{technician.nicOrPassport}</dd></div>
          <div><dt className="text-slate-400">Phone</dt><dd className="text-slate-900">{technician.phone || '-'}</dd></div>
          <div><dt className="text-slate-400">Email</dt><dd className="text-slate-900">{technician.email || '-'}</dd></div>
          <div><dt className="text-slate-400">Certifications</dt><dd className="text-slate-900">{technician.certifications.join(', ') || '-'}</dd></div>
        </dl>
      </div>
    </div>
  );
}

export default TechnicianDetailModal;
