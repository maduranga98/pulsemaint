import { useTranslation } from 'react-i18next';
import type { TrainingModuleCategory } from '@/lib/training/trainingTypes';

interface ModuleTypeBadgeProps {
  machineName: string;
  category?: TrainingModuleCategory;
  className?: string;
}

export default function ModuleTypeBadge({ machineName, category = 'machine', className = '' }: ModuleTypeBadgeProps) {
  const { t } = useTranslation();
  if (category === 'offboard') {
    return (
      <span
        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700 ${className}`}
        aria-label={t('common.trainingShared.moduleTypeBadge.offboardAria')}
      >
        {t('common.trainingShared.moduleTypeBadge.offboardLabel')}
      </span>
    );
  }
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600 ${className}`}
      aria-label={t('common.trainingShared.moduleTypeBadge.machineAria', { name: machineName })}
    >
      {machineName}
    </span>
  );
}
