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
        aria-label={t('common.training.moduleTypeBadge.ariaOffboard')}
      >
        {t('common.training.moduleTypeBadge.offboardLabel')}
      </span>
    );
  }
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600 ${className}`}
      aria-label={t('common.training.moduleTypeBadge.ariaMachine', { name: machineName })}
    >
      {machineName}
    </span>
  );
}
