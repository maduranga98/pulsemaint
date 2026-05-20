import type { ShiftStatsAuto } from '@/types/handover.types';

interface ShiftStatsGridProps {
  stats: ShiftStatsAuto;
  compact?: boolean;
}

const ITEMS: Array<{ key: keyof ShiftStatsAuto; label: string; tone: string }> = [
  { key: 'breakdownsOpened', label: 'Breakdowns', tone: 'text-red-600' },
  { key: 'wosPending', label: 'Open WOs', tone: 'text-amber-600' },
  { key: 'pmsCompleted', label: 'PMs Done', tone: 'text-emerald-600' },
  { key: 'productionHoursLost', label: 'Hours Lost', tone: 'text-cyan-600' },
  { key: 'partsIssued', label: 'Parts Issued', tone: 'text-blue-600' },
  { key: 'wosCompleted', label: 'WOs Completed', tone: 'text-emerald-600' },
  { key: 'criticalBreakdowns', label: 'Critical', tone: 'text-red-600' },
  { key: 'pmsMissed', label: 'PMs Missed', tone: 'text-amber-600' },
];

export function ShiftStatsGrid({ stats, compact = false }: ShiftStatsGridProps) {
  const items = compact ? ITEMS.slice(0, 4) : ITEMS;
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {items.map((item) => (
        <div key={item.key} className="rounded-lg border border-slate-200 bg-white p-4">
          <div className={`font-[Sora] text-2xl font-bold ${item.tone}`}>{stats[item.key]}</div>
          <div className="mt-1 text-xs font-medium text-slate-500">{item.label}</div>
        </div>
      ))}
    </div>
  );
}

export default ShiftStatsGrid;
