import type { ContractorDocument } from '@/lib/contractors/contractorTypes';
import { formatExpiryText } from '@/lib/contractors/documentExpiryHelper';

interface DocumentExpiryTimerProps {
  document: Pick<ContractorDocument, 'isPermanent' | 'validityStatus' | 'daysUntilExpiry'>;
}

export function DocumentExpiryTimer({ document }: DocumentExpiryTimerProps) {
  const className =
    document.validityStatus === 'expired'
      ? 'text-red-700 font-semibold'
      : document.validityStatus === 'expiring_soon'
        ? 'text-amber-700 font-semibold'
        : 'text-emerald-700';

  return <span className={`text-xs ${className}`}>{formatExpiryText(document)}</span>;
}

export default DocumentExpiryTimer;
