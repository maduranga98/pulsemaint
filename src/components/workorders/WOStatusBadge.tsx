import { useTranslation } from 'react-i18next';
import type { WOStatus } from '../../types/workOrder';
import { WO_STATUS_CONFIG } from '../../constants/woConfig';

interface WOStatusBadgeProps {
  status: WOStatus;
  size?: 'sm' | 'md';
  /** Closed WO that was extended — shown as "Extended WO". */
  extended?: boolean;
}

export function WOStatusBadge({ status, size = 'md', extended = false }: WOStatusBadgeProps) {
  const { t } = useTranslation();
  const config = WO_STATUS_CONFIG[status];
  const sizeClass = size === 'sm' ? 'text-xs px-1.5 py-0.5' : 'text-xs px-2.5 py-1';

  if (extended && (status === 'CLOSED' || status === 'SIGNED_OFF')) {
    return (
      <span className={`inline-flex items-center gap-1.5 rounded-full font-medium ${sizeClass} bg-indigo-100 text-indigo-700`}>
        <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
        {t('common.workOrders.extension.statusExtended', { defaultValue: 'Extended WO' })}
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-medium ${sizeClass} ${config.bgClass} ${config.textClass}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${config.dotClass}`} />
      {t(`common.workOrders.statuses.${status}`)}
    </span>
  );
}
