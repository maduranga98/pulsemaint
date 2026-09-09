import { useTranslation } from 'react-i18next';
import type { WatchLevel } from '@/types/handover.types';

interface WatchFlagBadgeProps {
  level: WatchLevel;
}

const CONFIG: Record<WatchLevel, { labelKey: string; dot: string; text: string }> = {
  critical_watch: { labelKey: 'common.shiftHandovers.watchFlagBadge.criticalWatch', dot: 'bg-red-500', text: 'text-red-700' },
  monitor: { labelKey: 'common.shiftHandovers.watchFlagBadge.monitor', dot: 'bg-amber-500', text: 'text-amber-700' },
  info_only: { labelKey: 'common.shiftHandovers.watchFlagBadge.infoOnly', dot: 'bg-cyan-500', text: 'text-cyan-700' },
};

export function WatchFlagBadge({ level }: WatchFlagBadgeProps) {
  const { t } = useTranslation();
  const config = CONFIG[level];
  return (
    <span className={`inline-flex items-center gap-2 text-xs font-semibold ${config.text}`}>
      <span className={`h-2 w-2 rounded-full ${config.dot}`} />
      {t(config.labelKey)}
    </span>
  );
}

export default WatchFlagBadge;
