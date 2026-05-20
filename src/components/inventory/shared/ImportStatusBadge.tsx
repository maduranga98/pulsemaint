import type { ImportSessionStatus } from '@/types/inventory';

interface ImportStatusBadgeProps {
  status: ImportSessionStatus;
  size?: 'sm' | 'md';
}

const statusConfig: Record<ImportSessionStatus, { label: string; color: string; bg: string; pulse?: boolean }> = {
  validating: { label: 'Validating', color: 'text-blue-700', bg: 'bg-blue-50' },
  preview: { label: 'Preview', color: 'text-cyan-700', bg: 'bg-cyan-50' },
  importing: { label: 'Importing', color: 'text-blue-700', bg: 'bg-blue-50', pulse: true },
  completed: { label: 'Completed', color: 'text-green-700', bg: 'bg-green-50' },
  failed: { label: 'Failed', color: 'text-red-700', bg: 'bg-red-50' },
  reversed: { label: 'Reversed', color: 'text-gray-600', bg: 'bg-gray-100' },
};

const sizeClasses = {
  sm: 'px-2 py-0.5 text-xs gap-1',
  md: 'px-2.5 py-1 text-sm gap-1.5',
};

export function ImportStatusBadge({ status, size = 'sm' }: ImportStatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <span
      className={`inline-flex items-center rounded-full font-medium ${config.bg} ${config.color} ${sizeClasses[size]}`}
    >
      <span
        className={`inline-block w-1.5 h-1.5 rounded-full bg-current ${config.pulse ? 'animate-pulse' : ''}`}
      />
      {config.label}
    </span>
  );
}
