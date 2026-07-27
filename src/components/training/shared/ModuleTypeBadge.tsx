import { Building2 } from 'lucide-react';
import type { ModuleCategory } from '@/lib/training/trainingTypes';

interface ModuleTypeBadgeProps {
  machineName: string;
  moduleCategory?: ModuleCategory;
  providerName?: string;
  className?: string;
}

export default function ModuleTypeBadge({
  machineName,
  moduleCategory = 'machine',
  providerName = '',
  className = '',
}: ModuleTypeBadgeProps) {
  if (moduleCategory === 'offboard_external') {
    const label = providerName ? `External · ${providerName}` : 'Offboard / External';
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700 ${className}`}
        aria-label={label}
      >
        <Building2 size={12} aria-hidden="true" />
        {label}
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600 ${className}`}
      aria-label={`Machine: ${machineName}`}
    >
      {machineName}
    </span>
  );
}
