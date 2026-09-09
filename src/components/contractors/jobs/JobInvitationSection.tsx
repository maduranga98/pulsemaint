import { useTranslation } from 'react-i18next';
import type { ContractorInvitation, ContractorJob } from '@/lib/contractors/contractorTypes';
import InvitationStatusBadge from '@/components/contractors/shared/InvitationStatusBadge';

interface JobInvitationSectionProps {
  job: ContractorJob;
  invitations: ContractorInvitation[];
}

export function JobInvitationSection({ job, invitations }: JobInvitationSectionProps) {
  const { t } = useTranslation();
  const latest = invitations[0];

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="font-semibold text-slate-950">{t('common.contractors.jobs.invitation.title')}</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <p className="text-sm text-slate-600">{t('common.contractors.jobs.invitation.sent', { value: job.invitationSentAt ? job.invitationSentAt.toDate().toLocaleString() : '-' })}</p>
        <p className="text-sm text-slate-600">
          {job.invitationAcknowledgedAt
            ? t('common.contractors.jobs.invitation.acknowledged', { value: job.invitationAcknowledgedAt.toDate().toLocaleString() })
            : t('common.contractors.jobs.invitation.notAcknowledged')}
        </p>
      </div>
      <div className="mt-3">
        <InvitationStatusBadge emailDelivered={latest?.emailDelivered} whatsappDelivered={latest?.whatsappDelivered} />
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" className="rounded-md border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700">{t('common.contractors.jobs.invitation.actions.viewDetails')}</button>
        <button type="button" className="rounded-md bg-blue-600 px-3 py-2 text-xs font-semibold text-white">{t('common.contractors.jobs.invitation.actions.resend')}</button>
        {!job.invitationAcknowledgedAt && <button type="button" className="rounded-md bg-cyan-600 px-3 py-2 text-xs font-semibold text-white">{t('common.contractors.jobs.invitation.actions.markAcknowledged')}</button>}
      </div>
    </section>
  );
}

export default JobInvitationSection;
