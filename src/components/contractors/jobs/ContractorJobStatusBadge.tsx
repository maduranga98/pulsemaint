import type { ContractorJobStatus } from '@/lib/contractors/contractorTypes';

interface ContractorJobStatusBadgeProps {
  status: ContractorJobStatus;
}

const STATUS_CONFIG: Record<ContractorJobStatus, { label: string; className: string }> = {
  invitation_sent: { label: 'Invited', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  acknowledged: { label: 'Acknowledged', className: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
  contractor_arrived: { label: 'On Site', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  work_in_progress: { label: 'Working', className: 'bg-amber-50 text-amber-700 border-amber-200 animate-pulse' },
  checklist_complete: { label: 'Checklist Done', className: 'bg-violet-50 text-violet-700 border-violet-200' },
  signed_off: { label: 'Signed Off', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  invoice_submitted: { label: 'Invoice Pending', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  payment_processed: { label: 'Paid', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  cancelled: { label: 'Cancelled', className: 'bg-slate-100 text-slate-600 border-slate-200' },
};

export function ContractorJobStatusBadge({ status }: ContractorJobStatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  return <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${config.className}`}>{config.label}</span>;
}

export default ContractorJobStatusBadge;
