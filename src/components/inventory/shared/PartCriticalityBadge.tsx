import { AlertTriangle, ShieldAlert, AlertCircle, Minus } from 'lucide-react';
import type { PartCriticality } from '@/types/inventory';

interface PartCriticalityBadgeProps {
  criticality: PartCriticality;
  size?: 'sm' | 'md' | 'lg';
}

const criticalityConfig: Record<
  PartCriticality,
  { label: string; color: string; bg: string; Icon: React.ComponentType<{ className?: string }> }
> = {
  critical: {
    label: 'Critical',
    color: 'text-red-700',
    bg: 'bg-red-50',
    Icon: ShieldAlert,
  },
  high: {
    label: 'High',
    color: 'text-orange-700',
    bg: 'bg-orange-50',
    Icon: AlertTriangle,
  },
  medium: {
    label: 'Medium',
    color: 'text-amber-700',
    bg: 'bg-amber-50',
    Icon: AlertCircle,
  },
  low: {
    label: 'Low',
    color: 'text-gray-600',
    bg: 'bg-gray-100',
    Icon: Minus,
  },
};

const sizeClasses = {
  sm: 'px-2 py-0.5 text-xs gap-1',
  md: 'px-2.5 py-1 text-sm gap-1.5',
  lg: 'px-3 py-1.5 text-base gap-2',
};

const iconSizes = {
  sm: 'w-3 h-3',
  md: 'w-3.5 h-3.5',
  lg: 'w-4 h-4',
};

export function PartCriticalityBadge({ criticality, size = 'sm' }: PartCriticalityBadgeProps) {
  const config = criticalityConfig[criticality];
  const { Icon } = config;

  return (
    <span
      className={`inline-flex items-center rounded-full font-medium ${config.bg} ${config.color} ${sizeClasses[size]}`}
    >
      <Icon className={iconSizes[size]} />
      {config.label}
    </span>
  );
}
