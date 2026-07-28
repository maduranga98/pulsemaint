import type { TrainingModuleStatus } from '@/lib/training/trainingTypes';

const STATUS_BADGE: Record<TrainingModuleStatus, string> = {
  draft: 'bg-yellow-100 text-yellow-800',
  active: 'bg-green-100 text-green-800',
  archived: 'bg-gray-100 text-gray-600',
};

const STATUS_LABEL: Record<TrainingModuleStatus, string> = {
  draft: 'Draft',
  active: 'Active',
  archived: 'Archived',
};

/** Purely presentational and identical in both libraries — the module
 *  lifecycle badge (Draft / Active / Archived). */
export default function ModuleStatusBadge({ status }: { status: TrainingModuleStatus }) {
  return (
    <span
      className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
        STATUS_BADGE[status] ?? STATUS_BADGE.draft
      }`}
    >
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}
