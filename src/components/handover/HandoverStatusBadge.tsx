import type { HandoverStatus } from '@/types/handover.types';

interface HandoverStatusBadgeProps {
  status: HandoverStatus;
}

const CONFIG: Record<HandoverStatus, { label: string; dot: string; text: string }> = {
  pending_acceptance: { label: 'Pending Acceptance', dot: 'bg-amber-500', text: 'text-amber-700' },
  accepted: { label: 'Accepted', dot: 'bg-emerald-500', text: 'text-emerald-700' },
  archived: { label: 'Archived', dot: 'bg-slate-400', text: 'text-slate-600' },
};

export function HandoverStatusBadge({ status }: HandoverStatusBadgeProps) {
  const config = CONFIG[status];
  return (
    <span className={`inline-flex items-center gap-2 text-xs font-semibold ${config.text}`}>
      <span className={`h-2 w-2 rounded-full ${config.dot}`} />
      {config.label}
    </span>
  );
}

export default HandoverStatusBadge;
