import { PM_STATUS_CONFIG, PM_OPERATIONAL_STATUS_CONFIG } from '../../constants/pmConfig';
import type { PMStatus, PMOperationalStatus } from '../../types/pm.types';

interface PMStatusBadgeProps {
  status: PMStatus;
  size?: 'sm' | 'md';
}

export function PMStatusBadge({ status, size = 'md' }: PMStatusBadgeProps) {
  const config = PM_STATUS_CONFIG[status];
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

interface PMOperationalStatusBadgeProps {
  status: PMOperationalStatus;
  size?: 'sm' | 'md';
}

export function PMOperationalStatusBadge({ status, size = 'md' }: PMOperationalStatusBadgeProps) {
  const config = PM_OPERATIONAL_STATUS_CONFIG[status];
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
