import type { MachineStatus } from '../../types/machine';

interface MachineStatusBadgeProps {
  status: MachineStatus;
  size?: 'sm' | 'md' | 'lg';
}

const statusConfig: Record<MachineStatus, { label: string; color: string; bg: string }> = {
  active: {
    label: 'Active',
    color: 'text-green-600',
    bg: 'bg-green-50',
  },
  under_maintenance: {
    label: 'Under Maintenance',
    color: 'text-amber-600',
    bg: 'bg-amber-50',
  },
  decommissioned: {
    label: 'Decommissioned',
    color: 'text-gray-600',
    bg: 'bg-gray-100',
  },
};

const sizeClasses = {
  sm: 'px-2 py-1 text-xs',
  md: 'px-3 py-1.5 text-sm',
  lg: 'px-4 py-2 text-base',
};

export function MachineStatusBadge({ status, size = 'md' }: MachineStatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <div className={`inline-flex items-center rounded-full font-medium ${config.bg} ${config.color} ${sizeClasses[size]}`}>
      <div className="inline-block w-2 h-2 rounded-full mr-1.5 bg-current" />
      {config.label}
    </div>
  );
}
