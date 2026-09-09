import { useTranslation } from 'react-i18next';
import type { TrainingModuleStatus } from '@/lib/training/trainingTypes';

const STATUS_BADGE: Record<TrainingModuleStatus, string> = {
  draft: 'bg-yellow-100 text-yellow-800',
  active: 'bg-green-100 text-green-800',
  archived: 'bg-gray-100 text-gray-600',
};

/** Purely presentational and identical in both libraries — the module
 *  lifecycle badge (Draft / Active / Archived). */
export default function ModuleStatusBadge({ status }: { status: TrainingModuleStatus }) {
  const { t } = useTranslation();
  return (
    <span
      className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
        STATUS_BADGE[status] ?? STATUS_BADGE.draft
      }`}
    >
      {t(`common.trainingShared.manager.library.moduleStatus.${status}`, { defaultValue: status })}
    </span>
  );
}
