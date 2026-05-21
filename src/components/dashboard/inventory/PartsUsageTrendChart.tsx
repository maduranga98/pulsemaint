import { useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import DashboardWidget from '../shared/DashboardWidget';
import { CHART_COLORS, CHART_DEFAULTS } from '../../../constants/chartTheme';
import EmptyState from '../shared/EmptyState';

interface PartsUsageTrendChartProps {
  companyId: string;
}

export default function PartsUsageTrendChart({}: PartsUsageTrendChartProps) {
  const [mode, setMode] = useState<'count' | 'value'>('count');

  // Placeholder data — would be fetched from analytics_daily.partsIssued
  const data = Array.from({ length: 30 }, (_, i) => ({
    day: `${i + 1}`,
    count: Math.floor(Math.random() * 20) + 5,
    value: Math.floor(Math.random() * 50000) + 10000,
  }));

  return (
    <DashboardWidget
      title="Parts Usage Trend"
      action={
        <div className="flex bg-[#0A1628] rounded-md border border-[#1E3A5F]">
          <button
            onClick={() => setMode('count')}
            className={`px-2 py-0.5 text-[10px] font-medium rounded-sm ${mode === 'count' ? 'bg-[#1A56DB] text-white' : 'text-[#8BA3BF]'}`}
          >
            Count
          </button>
          <button
            onClick={() => setMode('value')}
            className={`px-2 py-0.5 text-[10px] font-medium rounded-sm ${mode === 'value' ? 'bg-[#1A56DB] text-white' : 'text-[#8BA3BF]'}`}
          >
            Value
          </button>
        </div>
      }
    >
      {data.length === 0 ? (
        <EmptyState message="No usage data" />
      ) : (
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid {...CHART_DEFAULTS.cartesianGrid} />
              <XAxis {...CHART_DEFAULTS.xAxis} dataKey="day" tick={{ fontSize: 9 }} interval={4} />
              <YAxis {...CHART_DEFAULTS.yAxis} />
              <Tooltip {...CHART_DEFAULTS.tooltip} />
              <Line
                type="monotone"
                dataKey={mode}
                stroke={CHART_COLORS.primary}
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </DashboardWidget>
  );
}
