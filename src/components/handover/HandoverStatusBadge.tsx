import { useTranslation } from 'react-i18next';
import type { HandoverStatus } from '@/types/handover.types';

interface HandoverStatusBadgeProps {
  status: HandoverStatus;
}

const CONFIG: Record<HandoverStatus, { labelKey: string; dot: string; text: string }> = {
  pending_acceptance: { labelKey: 'common.shiftHandovers.statusBadge.pendingAcceptance', dot: 'bg-amber-500', text: 'text-amber-700' },
  accepted: { labelKey: 'common.shiftHandovers.statusBadge.accepted', dot: 'bg-emerald-500', text: 'text-emerald-700' },
  archived: { labelKey: 'common.shiftHandovers.statusBadge.archived', dot: 'bg-slate-400', text: 'text-slate-600' },
};

export function HandoverStatusBadge({ status }: HandoverStatusBadgeProps) {
  const { t } = useTranslation();
  const config = CONFIG[status];
  return (
    <span className={`inline-flex items-center gap-2 text-xs font-semibold ${config.text}`}>
      <span className={`h-2 w-2 rounded-full ${config.dot}`} />
      {t(config.labelKey)}
    </span>
  );
}

export default HandoverStatusBadge;
