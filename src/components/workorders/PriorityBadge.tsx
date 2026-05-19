import type { WOPriority } from '../../types/workOrder';
import { WO_PRIORITY_CONFIG } from '../../constants/woConfig';

interface PriorityBadgeProps {
  priority: WOPriority;
  size?: 'sm' | 'md';
}

export function PriorityBadge({ priority, size = 'md' }: PriorityBadgeProps) {
  const config = WO_PRIORITY_CONFIG[priority];
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
