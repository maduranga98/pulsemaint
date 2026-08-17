import { useTranslation } from 'react-i18next';
import type { AssignmentStatus } from '@/lib/training/trainingTypes';

interface TrainingStatusBadgeProps {
  status: AssignmentStatus;
  className?: string;
}

const STATUS_CONFIG: Record<
  AssignmentStatus,
  { labelKey: string; className: string; pulse?: boolean }
> = {
  not_started: {
    labelKey: 'common.training.trainingStatusBadge.not_started',
    className: 'bg-gray-100 text-gray-600',
  },
  in_progress: {
    labelKey: 'common.training.trainingStatusBadge.in_progress',
    className: 'bg-blue-100 text-blue-700',
  },
  quiz_passed: {
    labelKey: 'common.training.trainingStatusBadge.quiz_passed',
    className: 'bg-amber-100 text-amber-700',
  },
  quiz_failed: {
    labelKey: 'common.training.trainingStatusBadge.quiz_failed',
    className: 'bg-red-100 text-red-700',
  },
  awaiting_practical: {
    labelKey: 'common.training.trainingStatusBadge.awaiting_practical',
    className: 'bg-amber-100 text-amber-700',
  },
  certified: {
    labelKey: 'common.training.trainingStatusBadge.certified',
    className: 'bg-green-100 text-green-700',
  },
  expired: {
    labelKey: 'common.training.trainingStatusBadge.expired',
    className: 'bg-red-100 text-red-700',
  },
  retraining_required: {
    labelKey: 'common.training.trainingStatusBadge.retraining_required',
    className: 'bg-red-100 text-red-700',
    pulse: true,
  },
};

export default function TrainingStatusBadge({
  status,
  className = '',
}: TrainingStatusBadgeProps) {
  const { t } = useTranslation();
  const config = STATUS_CONFIG[status];
  const label = t(config.labelKey);

  return (
    <span
      className={[
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
        config.className,
        config.pulse ? 'animate-pulse' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      aria-label={t('common.training.trainingStatusBadge.ariaStatus', { label })}
    >
      {label}
    </span>
  );
}
