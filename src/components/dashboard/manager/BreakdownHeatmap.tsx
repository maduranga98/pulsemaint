import { useState } from 'react';
import DashboardWidget from '../shared/DashboardWidget';
import { useBreakdownHeatmap } from '../../../hooks/dashboard/useBreakdownHeatmap';
import { heatmapColor } from '../../../constants/chartTheme';
import { dayLabel, hourLabel } from '../../../utils/heatmap.utils';
import type { ChartDateRange } from '../../../types/analytics.types';
import EmptyState from '../shared/EmptyState';

const RANGES: { label: string; value: ChartDateRange }[] = [
  { label: 'This Month', value: '30D' },
  { label: 'Last 3M', value: '3M' },
  { label: 'Last 6M', value: '6M' },
];

interface BreakdownHeatmapProps {
  companyId: string;
}

export default function BreakdownHeatmap({ companyId }: BreakdownHeatmapProps) {
  const [range, setRange] = useState<ChartDateRange>('30D');
  const { heatmap, loading, error, refetch } = useBreakdownHeatmap(companyId, range);

  return (
    <DashboardWidget
      title="Breakdown Frequency Heatmap"
      loading={loading}
      error={error}
      onRetry={refetch}
      action={
        <div className="flex bg-[#0A1628] rounded-md border border-[#1E3A5F]">
          {RANGES.map((r) => (
            <button
              key={r.value}
              onClick={() => setRange(r.value)}
              className={`px-2 py-0.5 text-[10px] font-medium rounded-sm whitespace-nowrap ${
                range === r.value ? 'bg-[#1A56DB] text-white' : 'text-[#8BA3BF]'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      }
    >
      {heatmap.length === 0 ? (
        <EmptyState message="No heatmap data" />
      ) : (
        <div className="space-y-2">
          {/* Day labels */}
          <div className="grid grid-cols-8 gap-1">
            <div className="text-[9px] text-[#8BA3BF]" />
            {Array.from({ length: 7 }, (_, d) => (
              <div key={d} className="text-center text-[9px] text-[#8BA3BF]">
                {dayLabel(d)}
              </div>
            ))}
          </div>

          {/* Hour rows */}
          <div className="max-h-[280px] overflow-y-auto space-y-0.5">
            {Array.from({ length: 24 }, (_, hour) => (
              <div key={hour} className="grid grid-cols-8 gap-1 items-center">
                <div className="text-[9px] text-[#8BA3BF] text-right pr-1">
                  {hourLabel(hour)}
                </div>
                {Array.from({ length: 7 }, (_, day) => {
                  const cell = heatmap.find((c) => c.day === day && c.hour === hour);
                  const intensity = cell?.intensity ?? 0;
                  return (
                    <div
                      key={day}
                      className="aspect-square rounded-sm transition-colors"
                      style={{ backgroundColor: heatmapColor(intensity) }}
                      title={`${dayLabel(day)} ${hourLabel(hour)} — ${cell?.count ?? 0} breakdowns`}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </DashboardWidget>
  );
}
