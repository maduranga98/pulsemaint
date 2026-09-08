import { useTranslation } from 'react-i18next';

interface RequestPriorityBadgeProps {
  priority: 'critical' | 'high' | 'medium' | 'low';
  isUrgent?: boolean;
}

const config: Record<
  RequestPriorityBadgeProps['priority'],
  { className: string; pulse: boolean }
> = {
  critical: {
    className: 'bg-red-100 text-red-700 border border-red-300',
    pulse: true,
  },
  high: {
    className: 'bg-red-100 text-red-700 border border-red-200',
    pulse: false,
  },
  medium: {
    className: 'bg-amber-100 text-amber-700 border border-amber-200',
    pulse: false,
  },
  low: {
    className: 'bg-gray-100 text-gray-600 border border-gray-200',
    pulse: false,
  },
};

export function RequestPriorityBadge({ priority, isUrgent }: RequestPriorityBadgeProps) {
  const { t } = useTranslation();
  const { className, pulse } = config[priority];
  const shouldPulse = pulse || isUrgent;
  const label = t(`common.workOrders.priorities.${priority}`);

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${className} ${shouldPulse ? 'animate-pulse' : ''}`}
    >
      {isUrgent && <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />}
      {label}
      {isUrgent && <span className="text-red-500 font-bold">!</span>}
    </span>
  );
}
