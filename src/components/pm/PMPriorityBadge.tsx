import type { PMSchedule } from '../../types/pm.types';
import { PM_PRIORITY_CONFIG } from '../../constants/pmConfig';

interface PMPriorityBadgeProps {
  priority: PMSchedule['priority'];
  size?: 'sm' | 'md';
}

export function PMPriorityBadge({ priority, size = 'md' }: PMPriorityBadgeProps) {
  const config = PM_PRIORITY_CONFIG[priority];
  const sizeClass = size === 'sm' ? 'text-xs px-1.5 py-0.5' : 'text-xs px-2.5 py-1';

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-semibold ${sizeClass} ${config.bgClass} ${config.textClass}`}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: config.color }}
      />
      {config.label}
    </span>
  );
}
