import type { TriageSessionStatus } from '../../../types/triage';

interface Props {
  status: TriageSessionStatus;
}

const statusConfig: Record<TriageSessionStatus, { label: string; className: string }> = {
  in_progress: { label: 'In Progress', className: 'bg-blue-100 text-blue-700' },
  completed: { label: 'Completed', className: 'bg-green-100 text-green-700' },
  escalated: { label: 'Escalated', className: 'bg-red-100 text-red-700' },
  quick_fix: { label: 'Quick Fix', className: 'bg-teal-100 text-teal-700' },
  abandoned: { label: 'Abandoned', className: 'bg-gray-100 text-gray-600' },
};

export default function TriageSessionStatusBadge({ status }: Props) {
  const cfg = statusConfig[status];
  return (
    <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full ${cfg.className}`}>
      {cfg.label}
    </span>
  );
}
