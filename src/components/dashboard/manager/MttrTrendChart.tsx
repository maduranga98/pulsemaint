import { useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import DashboardWidget from '../shared/DashboardWidget';
import ChartDateRangeSelector from '../shared/ChartDateRangeSelector';
import { useMttrTrend } from '../../../hooks/dashboard/useMttrTrend';
import { CHART_DEFAULTS } from '../../../constants/chartTheme';
import type { ChartDateRange } from '../../../types/analytics.types';
import EmptyState from '../shared/EmptyState';

interface MttrTrendChartProps {
  companyId: string;
}

export default function MttrTrendChart({ companyId }: MttrTrendChartProps) {
  const [range, setRange] = useState<ChartDateRange>('30D');
  const { data, loading, error, refetch } = useMttrTrend(companyId, range);

  const chartData = data.map((d) => ({
    date: d.date.slice(5), // MM-DD
    mttr: Number(d.mttrHours.toFixed(2)),
    slaTarget: 4,
  }));

  return (
    <DashboardWidget
      title="MTTR Trend"
      loading={loading}
      error={error}
      onRetry={refetch}
      action={<ChartDateRangeSelector value={range} onChange={setRange} />}
    >
      {chartData.length === 0 ? (
        <EmptyState message="No MTTR data" />
      ) : (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid {...CHART_DEFAULTS.cartesianGrid} />
              <XAxis {...CHART_DEFAULTS.xAxis} dataKey="date" />
              <YAxis {...CHART_DEFAULTS.yAxis} unit="h" />
              <Tooltip {...CHART_DEFAULTS.tooltip} />
              <ReferenceLine
                y={4}
                stroke="#F59E0B"
                strokeDasharray="4 4"
                label={{ value: 'SLA Target', fill: '#F59E0B', fontSize: 11 }}
              />
              <Line
                type="monotone"
                dataKey="mttr"
                stroke="#1A56DB"
                strokeWidth={2}
                dot={{ r: 3, fill: '#1A56DB' }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </DashboardWidget>
  );
}
