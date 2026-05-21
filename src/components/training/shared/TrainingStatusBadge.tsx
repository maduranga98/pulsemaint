import type { AssignmentStatus } from '@/lib/training/trainingTypes';

interface TrainingStatusBadgeProps {
  status: AssignmentStatus;
  className?: string;
}

const STATUS_CONFIG: Record<
  AssignmentStatus,
  { label: string; className: string; pulse?: boolean }
> = {
  not_started: {
    label: 'Not Started',
    className: 'bg-gray-100 text-gray-600',
  },
  in_progress: {
    label: 'In Progress',
    className: 'bg-blue-100 text-blue-700',
  },
  quiz_passed: {
    label: 'Quiz Passed',
    className: 'bg-amber-100 text-amber-700',
  },
  quiz_failed: {
    label: 'Failed — Retry',
    className: 'bg-red-100 text-red-700',
  },
  awaiting_practical: {
    label: 'Awaiting Sign-Off',
    className: 'bg-amber-100 text-amber-700',
  },
  certified: {
    label: 'Certified ✓',
    className: 'bg-green-100 text-green-700',
  },
  expired: {
    label: 'Expired',
    className: 'bg-red-100 text-red-700',
  },
  retraining_required: {
    label: 'Retraining Required',
    className: 'bg-red-100 text-red-700',
    pulse: true,
  },
};

export default function TrainingStatusBadge({
  status,
  className = '',
}: TrainingStatusBadgeProps) {
  const config = STATUS_CONFIG[status];

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
      aria-label={`Status: ${config.label}`}
    >
      {config.label}
    </span>
  );
}
