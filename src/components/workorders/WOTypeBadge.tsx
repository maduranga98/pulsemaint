import { useTranslation } from 'react-i18next';
import type { WOType } from '../../types/workOrder';
import { WO_TYPE_CONFIG } from '../../constants/woConfig';

interface WOTypeBadgeProps {
  woType: WOType;
  showIcon?: boolean;
  size?: 'sm' | 'md';
}

const TYPE_LABEL_KEYS: Record<WOType, string> = {
  BREAKDOWN: 'common.workorders.typeBadge.BREAKDOWN',
  CORRECTIVE: 'common.workorders.typeBadge.CORRECTIVE',
  PREVENTIVE: 'common.workorders.typeBadge.PREVENTIVE',
  INSTALLATION: 'common.workorders.typeBadge.INSTALLATION',
  MODIFICATION: 'common.workorders.typeBadge.MODIFICATION',
  INSPECTION: 'common.workorders.typeBadge.INSPECTION',
  CONTRACTOR: 'common.workorders.typeBadge.CONTRACTOR',
  OTHER: 'common.workorders.typeBadge.OTHER',
};

export function WOTypeBadge({ woType, showIcon = true, size = 'md' }: WOTypeBadgeProps) {
  const { t } = useTranslation();
  const config = WO_TYPE_CONFIG[woType];
  const sizeClass = size === 'sm' ? 'text-xs px-1.5 py-0.5' : 'text-xs px-2.5 py-1';

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-medium ${sizeClass} ${config.bgClass} ${config.textClass}`}
    >
      {showIcon && <span>{config.icon}</span>}
      {t(TYPE_LABEL_KEYS[woType])}
    </span>
  );
}
