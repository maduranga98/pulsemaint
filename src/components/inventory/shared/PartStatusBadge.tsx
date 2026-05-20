import type { PartStatus } from '@/types/inventory';

interface PartStatusBadgeProps {
  status: PartStatus;
  size?: 'sm' | 'md' | 'lg';
}

const statusConfig: Record<PartStatus, { label: string; color: string; bg: string }> = {
  active: {
    label: 'Active',
    color: 'text-green-700',
    bg: 'bg-green-50',
  },
  inactive: {
    label: 'Inactive',
    color: 'text-amber-700',
    bg: 'bg-amber-50',
  },
  discontinued: {
    label: 'Discontinued',
    color: 'text-gray-600',
    bg: 'bg-gray-100',
  },
};

const sizeClasses = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-sm',
  lg: 'px-3 py-1.5 text-base',
};

export function PartStatusBadge({ status, size = 'sm' }: PartStatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-medium ${config.bg} ${config.color} ${sizeClasses[size]}`}
    >
      <span className="inline-block w-1.5 h-1.5 rounded-full bg-current" />
      {config.label}
    </span>
  );
}
