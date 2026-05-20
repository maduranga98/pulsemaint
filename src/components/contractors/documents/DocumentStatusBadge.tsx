import { AlertTriangle, CheckCircle2, Clock, InfinityIcon } from 'lucide-react';
import type { ContractorDocument } from '@/lib/contractors/contractorTypes';
import { formatExpiryText } from '@/lib/contractors/documentExpiryHelper';

interface DocumentStatusBadgeProps {
  document: Pick<ContractorDocument, 'isPermanent' | 'validityStatus' | 'daysUntilExpiry' | 'blocksAssignment'>;
}

export function DocumentStatusBadge({ document }: DocumentStatusBadgeProps) {
  if (document.isPermanent) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
        <InfinityIcon className="h-3.5 w-3.5" />
        No Expiry
      </span>
    );
  }

  const config = {
    valid: { Icon: CheckCircle2, className: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
    expiring_soon: { Icon: Clock, className: 'border-amber-200 bg-amber-50 text-amber-700' },
    expired: { Icon: AlertTriangle, className: 'border-red-200 bg-red-50 text-red-700' },
  }[document.validityStatus];

  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-medium ${config.className} ${document.daysUntilExpiry !== undefined && document.daysUntilExpiry !== null && document.daysUntilExpiry <= 7 && document.daysUntilExpiry >= 0 ? 'animate-pulse' : ''}`}>
      <config.Icon className="h-3.5 w-3.5" />
      {formatExpiryText(document)}
      {document.blocksAssignment ? ' - Blocks assignment' : ''}
    </span>
  );
}

export default DocumentStatusBadge;
