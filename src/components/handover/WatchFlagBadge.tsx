import type { WatchLevel } from '@/types/handover.types';

interface WatchFlagBadgeProps {
  level: WatchLevel;
}

const CONFIG: Record<WatchLevel, { label: string; dot: string; text: string }> = {
  critical_watch: { label: 'Critical Watch', dot: 'bg-red-500', text: 'text-red-700' },
  monitor: { label: 'Monitor', dot: 'bg-amber-500', text: 'text-amber-700' },
  info_only: { label: 'Info Only', dot: 'bg-cyan-500', text: 'text-cyan-700' },
};

export function WatchFlagBadge({ level }: WatchFlagBadgeProps) {
  const config = CONFIG[level];
  return (
    <span className={`inline-flex items-center gap-2 text-xs font-semibold ${config.text}`}>
      <span className={`h-2 w-2 rounded-full ${config.dot}`} />
      {config.label}
    </span>
  );
}

export default WatchFlagBadge;
