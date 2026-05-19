import type { WOType } from '../../types/workOrder';
import { WO_TYPE_CONFIG } from '../../constants/woConfig';

interface WOTypeBadgeProps {
  woType: WOType;
  showIcon?: boolean;
  size?: 'sm' | 'md';
}

export function WOTypeBadge({ woType, showIcon = true, size = 'md' }: WOTypeBadgeProps) {
  const config = WO_TYPE_CONFIG[woType];
  const sizeClass = size === 'sm' ? 'text-xs px-1.5 py-0.5' : 'text-xs px-2.5 py-1';

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-medium ${sizeClass} ${config.bgClass} ${config.textClass}`}
    >
      {showIcon && <span>{config.icon}</span>}
      {config.label}
    </span>
  );
}
