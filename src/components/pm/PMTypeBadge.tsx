import type { PMType } from '../../types/pm.types';
import { PM_TYPE_CONFIG } from '../../constants/pmConfig';

interface PMTypeBadgeProps {
  pmType: PMType;
  size?: 'sm' | 'md';
}

// Shows the PM type exactly as picked in the "PM Type" selector when the
// Preventive WO was created — this is the "Type" PM Schedules should match.
export function PMTypeBadge({ pmType, size = 'md' }: PMTypeBadgeProps) {
  const config = PM_TYPE_CONFIG[pmType];
  const sizeClass = size === 'sm' ? 'text-xs px-1.5 py-0.5' : 'text-xs px-2.5 py-1';

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-medium ${sizeClass} ${config.bgClass} ${config.textClass}`}
    >
      <span>{config.icon}</span>
      {config.label}
    </span>
  );
}
