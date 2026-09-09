import { useTranslation } from 'react-i18next';
import type { ShiftStatsAuto } from '@/types/handover.types';

interface ShiftStatsGridProps {
  stats: ShiftStatsAuto;
  compact?: boolean;
}

const ITEMS: Array<{ key: keyof ShiftStatsAuto; labelKey: string; tone: string }> = [
  { key: 'breakdownsOpened', labelKey: 'common.shiftHandovers.statsGrid.breakdowns', tone: 'text-red-600' },
  { key: 'wosPending', labelKey: 'common.shiftHandovers.statsGrid.openWOs', tone: 'text-amber-600' },
  { key: 'pmsCompleted', labelKey: 'common.shiftHandovers.statsGrid.pmsDone', tone: 'text-emerald-600' },
  { key: 'productionHoursLost', labelKey: 'common.shiftHandovers.statsGrid.hoursLost', tone: 'text-cyan-600' },
  { key: 'partsIssued', labelKey: 'common.shiftHandovers.statsGrid.partsIssued', tone: 'text-blue-600' },
  { key: 'wosCompleted', labelKey: 'common.shiftHandovers.statsGrid.wosCompleted', tone: 'text-emerald-600' },
  { key: 'criticalBreakdowns', labelKey: 'common.shiftHandovers.statsGrid.critical', tone: 'text-red-600' },
  { key: 'pmsMissed', labelKey: 'common.shiftHandovers.statsGrid.pmsMissed', tone: 'text-amber-600' },
];

export function ShiftStatsGrid({ stats, compact = false }: ShiftStatsGridProps) {
  const { t } = useTranslation();
  const items = compact ? ITEMS.slice(0, 4) : ITEMS;
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {items.map((item) => (
        <div key={item.key} className="rounded-lg border border-slate-200 bg-white p-4">
          <div className={` text-2xl font-bold ${item.tone}`}>{stats[item.key]}</div>
          <div className="mt-1 text-xs font-medium text-slate-500">{t(item.labelKey)}</div>
        </div>
      ))}
    </div>
  );
}

export default ShiftStatsGrid;
