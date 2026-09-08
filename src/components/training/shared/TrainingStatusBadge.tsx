import { useTranslation } from 'react-i18next';
import type { AssignmentStatus } from '@/lib/training/trainingTypes';

interface TrainingStatusBadgeProps {
  status: AssignmentStatus;
  className?: string;
}

const STATUS_CLASS_CONFIG: Record<AssignmentStatus, { className: string; pulse?: boolean }> = {
  not_started: {
    className: 'bg-gray-100 text-gray-600',
  },
  in_progress: {
    className: 'bg-blue-100 text-blue-700',
  },
  quiz_passed: {
    className: 'bg-amber-100 text-amber-700',
  },
  quiz_failed: {
    className: 'bg-red-100 text-red-700',
  },
  awaiting_practical: {
    className: 'bg-amber-100 text-amber-700',
  },
  certified: {
    className: 'bg-green-100 text-green-700',
  },
  expired: {
    className: 'bg-red-100 text-red-700',
  },
  retraining_required: {
    className: 'bg-red-100 text-red-700',
    pulse: true,
  },
};

export default function TrainingStatusBadge({
  status,
  className = '',
}: TrainingStatusBadgeProps) {
  const { t } = useTranslation();
  const config = STATUS_CLASS_CONFIG[status];
  const label = t(`common.trainingShared.statusBadge.statuses.${status}`);

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
      aria-label={t('common.trainingShared.statusBadge.ariaLabel', { label })}
    >
      {label}
    </span>
  );
}
