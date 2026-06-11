import { useState } from 'react';
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import DashboardWidget from '../shared/DashboardWidget';
import ChartDateRangeSelector from '../shared/ChartDateRangeSelector';
import { usePmComplianceTrend } from '../../../hooks/dashboard/usePmComplianceTrend';
import { CHART_DEFAULTS } from '../../../constants/chartTheme';
import type { ChartDateRange } from '../../../types/analytics.types';
import EmptyState from '../shared/EmptyState';

interface PmTrendChartProps {
  companyId: string;
}

export default function PmTrendChart({ companyId }: PmTrendChartProps) {
  const [range, setRange] = useState<ChartDateRange>('30D');
  const { data, loading, error, refetch } = usePmComplianceTrend(companyId, range);

  const chartData = data.map((d) => ({
    date: d.date.slice(5),
    completed: d.pmsCompleted,
    missed: d.pmsMissed,
    compliance: Math.round(d.pmComplianceRate),
  }));

  const totalCompleted = chartData.reduce((s, d) => s + d.completed, 0);
  const totalMissed = chartData.reduce((s, d) => s + d.missed, 0);
  const overdueCount = totalMissed;

  return (
    <DashboardWidget
      title="PM Completion Trend"
      loading={loading}
      error={error}
      onRetry={refetch}
      action={<ChartDateRangeSelector value={range} onChange={setRange} />}
    >
      <div className="flex gap-6 mb-3 text-xs">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#10B981]" />
          <span className="text-[#8BA3BF]">Completed</span>
          <span className="text-[#10B981] font-semibold ml-1">{totalCompleted}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#EF4444]" />
          <span className="text-[#8BA3BF]">Overdue / Missed</span>
          <span className="text-[#EF4444] font-semibold ml-1">{overdueCount}</span>
        </div>
      </div>

      {chartData.length === 0 ? (
        <EmptyState message="No PM data" />
      ) : (
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData}>
              <CartesianGrid {...CHART_DEFAULTS.cartesianGrid} />
              <XAxis {...CHART_DEFAULTS.xAxis} dataKey="date" />
              <YAxis
                {...CHART_DEFAULTS.yAxis}
                yAxisId="count"
                allowDecimals={false}
              />
              <YAxis
                {...CHART_DEFAULTS.yAxis}
                yAxisId="pct"
                orientation="right"
                unit="%"
                domain={[0, 100]}
              />
              <Tooltip {...CHART_DEFAULTS.tooltip} />
              <Legend {...CHART_DEFAULTS.legend} />
              <Bar yAxisId="count" dataKey="completed" name="Completed" fill="#10B981" radius={[3, 3, 0, 0]} />
              <Bar yAxisId="count" dataKey="missed" name="Missed" fill="#EF4444" radius={[3, 3, 0, 0]} />
              <Line
                yAxisId="pct"
                type="monotone"
                dataKey="compliance"
                name="Compliance %"
                stroke="#F59E0B"
                strokeWidth={2}
                dot={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </DashboardWidget>
  );
}
