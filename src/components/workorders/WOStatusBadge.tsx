import type { WOStatus } from '../../types/workOrder';
import { WO_STATUS_CONFIG } from '../../constants/woConfig';

interface WOStatusBadgeProps {
  status: WOStatus;
  size?: 'sm' | 'md';
}

export function WOStatusBadge({ status, size = 'md' }: WOStatusBadgeProps) {
  const config = WO_STATUS_CONFIG[status];
  const sizeClass = size === 'sm' ? 'text-xs px-1.5 py-0.5' : 'text-xs px-2.5 py-1';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-medium ${sizeClass} ${config.bgClass} ${config.textClass}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${config.dotClass}`} />
      {config.label}
    </span>
  );
}
