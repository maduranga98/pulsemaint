import { useTranslation } from 'react-i18next';
import type { ContractorJobStatus } from '@/lib/contractors/contractorTypes';

interface ContractorJobStatusBadgeProps {
  status: ContractorJobStatus;
}

const STATUS_CLASSES: Record<ContractorJobStatus, string> = {
  invitation_sent: 'bg-blue-50 text-blue-700 border-blue-200',
  acknowledged: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  contractor_arrived: 'bg-amber-50 text-amber-700 border-amber-200',
  work_in_progress: 'bg-amber-50 text-amber-700 border-amber-200 animate-pulse',
  checklist_complete: 'bg-violet-50 text-violet-700 border-violet-200',
  signed_off: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  invoice_submitted: 'bg-amber-50 text-amber-700 border-amber-200',
  payment_processed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  cancelled: 'bg-slate-100 text-slate-600 border-slate-200',
};

export function ContractorJobStatusBadge({ status }: ContractorJobStatusBadgeProps) {
  const { t } = useTranslation();
  return (
    <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${STATUS_CLASSES[status]}`}>
      {t(`common.contractors.jobs.statusBadge.${status}`)}
    </span>
  );
}

export default ContractorJobStatusBadge;
