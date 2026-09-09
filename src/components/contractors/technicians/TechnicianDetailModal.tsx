import { useTranslation } from 'react-i18next';
import { UserRound } from 'lucide-react';
import type { ContractorTechnician } from '@/lib/contractors/contractorTypes';
import { SPECIALIZATION_LABELS } from '@/lib/contractors/contractorTypes';

interface TechnicianDetailModalProps {
  technician: ContractorTechnician | null;
  onClose: () => void;
}

export function TechnicianDetailModal({ technician, onClose }: TechnicianDetailModalProps) {
  const { t } = useTranslation();
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
              <p className="text-sm capitalize text-slate-500">{t(`common.contractors.technicians.designations.${technician.designation}`)}</p>
              <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${technician.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                {t(`common.contractors.technicians.statuses.${technician.status}`)}
              </span>
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-sm font-semibold text-slate-500">{t('common.contractors.technicians.detailModal.actions.close')}</button>
        </div>

        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div><dt className="text-slate-400">{t('common.contractors.technicians.detailModal.fields.nicOrPassport')}</dt><dd className="font-mono text-slate-900">{technician.nicOrPassport}</dd></div>
          <div><dt className="text-slate-400">{t('common.contractors.technicians.detailModal.fields.contractor')}</dt><dd className="text-slate-900">{technician.contractorName || '-'}</dd></div>
          <div><dt className="text-slate-400">{t('common.contractors.technicians.detailModal.fields.phone')}</dt><dd className="text-slate-900">{technician.phone || '-'}</dd></div>
          <div><dt className="text-slate-400">{t('common.contractors.technicians.detailModal.fields.email')}</dt><dd className="text-slate-900">{technician.email || '-'}</dd></div>
          <div><dt className="text-slate-400">{t('common.contractors.technicians.detailModal.fields.jobsAtThisFactory')}</dt><dd className="text-slate-900">{technician.jobsAtThisFactory}</dd></div>
          <div><dt className="text-slate-400">{t('common.contractors.technicians.detailModal.fields.lastVisit')}</dt><dd className="text-slate-900">{technician.lastVisitedAt ? technician.lastVisitedAt.toDate().toLocaleDateString() : t('common.contractors.technicians.card.never')}</dd></div>
        </dl>

        <div className="mt-4 text-sm">
          <dt className="text-slate-400">{t('common.contractors.technicians.detailModal.fields.specialization')}</dt>
          <dd className="mt-1 flex flex-wrap gap-1.5">
            {technician.specialization.length ? technician.specialization.map((tag) => (
              <span key={tag} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
                {SPECIALIZATION_LABELS[tag] ?? tag}
              </span>
            )) : <span className="text-slate-900">-</span>}
          </dd>
        </div>

        <div className="mt-4 text-sm">
          <dt className="text-slate-400">{t('common.contractors.technicians.detailModal.fields.certifications')}</dt>
          <dd className="text-slate-900">{technician.certifications.join(', ') || '-'}</dd>
        </div>

        {(technician.certificationDocuments?.length ?? 0) > 0 && (
          <div className="mt-4 text-sm">
            <dt className="mb-1 text-slate-400">{t('common.contractors.technicians.detailModal.fields.certificationFiles')}</dt>
            <ul className="space-y-1">
              {technician.certificationDocuments!.map((d) => (
                <li key={d.id} className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-1.5">
                  <span className="truncate text-slate-800">{d.name}</span>
                  <span className="ml-3 flex shrink-0 gap-3 text-xs font-medium">
                    <a href={d.url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">{t('common.contractors.technicians.detailModal.actions.view')}</a>
                    <a href={d.url} download={d.name} className="text-blue-600 hover:underline">{t('common.contractors.technicians.detailModal.actions.download')}</a>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

export default TechnicianDetailModal;
