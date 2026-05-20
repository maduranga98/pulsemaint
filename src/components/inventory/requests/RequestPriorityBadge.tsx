interface RequestPriorityBadgeProps {
  priority: 'critical' | 'high' | 'medium' | 'low';
  isUrgent?: boolean;
}

const config: Record<
  RequestPriorityBadgeProps['priority'],
  { label: string; className: string; pulse: boolean }
> = {
  critical: {
    label: 'Critical',
    className: 'bg-red-100 text-red-700 border border-red-300',
    pulse: true,
  },
  high: {
    label: 'High',
    className: 'bg-red-100 text-red-700 border border-red-200',
    pulse: false,
  },
  medium: {
    label: 'Medium',
    className: 'bg-amber-100 text-amber-700 border border-amber-200',
    pulse: false,
  },
  low: {
    label: 'Low',
    className: 'bg-gray-100 text-gray-600 border border-gray-200',
    pulse: false,
  },
};

export function RequestPriorityBadge({ priority, isUrgent }: RequestPriorityBadgeProps) {
  const { label, className, pulse } = config[priority];
  const shouldPulse = pulse || isUrgent;

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
