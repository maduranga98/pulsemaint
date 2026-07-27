import type { TrainingModuleCategory } from '@/lib/training/trainingTypes';

interface ModuleTypeBadgeProps {
  machineName: string;
  category?: TrainingModuleCategory;
  className?: string;
}

export default function ModuleTypeBadge({ machineName, category = 'machine', className = '' }: ModuleTypeBadgeProps) {
  if (category === 'offboard') {
    return (
      <span
        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700 ${className}`}
        aria-label="Offboard / External training"
      >
        Offboard / External
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
