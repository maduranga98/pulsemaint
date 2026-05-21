import type { ContractorInvitation, ContractorJob } from '@/lib/contractors/contractorTypes';
import InvitationStatusBadge from '@/components/contractors/shared/InvitationStatusBadge';

interface JobInvitationSectionProps {
  job: ContractorJob;
  invitations: ContractorInvitation[];
}

export function JobInvitationSection({ job, invitations }: JobInvitationSectionProps) {
  const latest = invitations[0];

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="font-semibold text-slate-950">Job Invitation</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <p className="text-sm text-slate-600">Sent: {job.invitationSentAt ? job.invitationSentAt.toDate().toLocaleString() : '-'}</p>
        <p className="text-sm text-slate-600">Acknowledged: {job.invitationAcknowledgedAt ? job.invitationAcknowledgedAt.toDate().toLocaleString() : 'Not acknowledged'}</p>
      </div>
      <div className="mt-3">
        <InvitationStatusBadge emailDelivered={latest?.emailDelivered} whatsappDelivered={latest?.whatsappDelivered} />
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" className="rounded-md border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700">View Invitation Details</button>
        <button type="button" className="rounded-md bg-blue-600 px-3 py-2 text-xs font-semibold text-white">Resend Invitation</button>
        {!job.invitationAcknowledgedAt && <button type="button" className="rounded-md bg-cyan-600 px-3 py-2 text-xs font-semibold text-white">Mark as Acknowledged</button>}
      </div>
    </section>
  );
}

export default JobInvitationSection;
