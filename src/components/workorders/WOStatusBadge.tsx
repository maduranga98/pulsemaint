import { useTranslation } from 'react-i18next';
import type { WOStatus } from '../../types/workOrder';
import { WO_STATUS_CONFIG } from '../../constants/woConfig';

interface WOStatusBadgeProps {
  status: WOStatus;
  size?: 'sm' | 'md';
}

const STATUS_LABEL_KEYS: Record<WOStatus, string> = {
  DRAFT: 'common.workorders.statusBadge.DRAFT',
  OPEN: 'common.workorders.statusBadge.OPEN',
  ASSIGNED: 'common.workorders.statusBadge.ASSIGNED',
  IN_PROGRESS: 'common.workorders.statusBadge.IN_PROGRESS',
  ON_HOLD_PARTS: 'common.workorders.statusBadge.ON_HOLD_PARTS',
  ON_HOLD_APPROVAL: 'common.workorders.statusBadge.ON_HOLD_APPROVAL',
  COMPLETED: 'common.workorders.statusBadge.COMPLETED',
  SIGNED_OFF: 'common.workorders.statusBadge.SIGNED_OFF',
  CLOSED: 'common.workorders.statusBadge.CLOSED',
  CANCELLED: 'common.workorders.statusBadge.CANCELLED',
};

export function WOStatusBadge({ status, size = 'md' }: WOStatusBadgeProps) {
  const { t } = useTranslation();
  const config = WO_STATUS_CONFIG[status];
  const sizeClass = size === 'sm' ? 'text-xs px-1.5 py-0.5' : 'text-xs px-2.5 py-1';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-medium ${sizeClass} ${config.bgClass} ${config.textClass}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${config.dotClass}`} />
      {t(STATUS_LABEL_KEYS[status])}
    </span>
  );
}
