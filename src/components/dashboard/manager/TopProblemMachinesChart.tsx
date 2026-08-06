import { useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LabelList,
} from 'recharts';
import DashboardWidget from '../shared/DashboardWidget';
import { useTopProblemMachines } from '../../../hooks/dashboard/useTopProblemMachines';
import { CHART_DEFAULTS } from '../../../constants/chartTheme';
import EmptyState from '../shared/EmptyState';

type MetricMode = 'breakdowns' | 'downtime' | 'cost';

// Bar colour reflects the machine's highest work-order / breakdown severity.
const SEVERITY_COLORS: Record<'critical' | 'high' | 'medium' | 'low', string> = {
  critical: '#EF4444',
  high: '#F97316',
  medium: '#F59E0B',
  low: '#10B981',
};

const MODE_CONFIG: Record<MetricMode, { label: string; unit: string; format: (v: number) => string }> = {
  breakdowns: { label: 'Count', unit: 'WOs', format: (v) => `${Math.round(v)}` },
  downtime: { label: 'Hours', unit: 'h', format: (v) => `${v.toFixed(1)}h` },
  cost: { label: 'Cost', unit: 'LKR', format: (v) => `LKR ${Math.round(v).toLocaleString()}` },
};

interface TopProblemMachinesChartProps {
  companyId: string;
  month: string | string[];
}

export default function TopProblemMachinesChart({ companyId, month }: TopProblemMachinesChartProps) {
  const [mode, setMode] = useState<MetricMode>('breakdowns');
  const { data, loading, error, refetch } = useTopProblemMachines(companyId, month);

  const machines = data?.topProblemMachines?.slice(0, 10) ?? [];
  const { format } = MODE_CONFIG[mode];

  const chartData = machines.map((m) => ({
    name: m.machineName,
    // "Count" = work-order count, "Hours" = WO completion durations,
    // "Cost" = inventory parts cost across the machine's WOs.
    value: mode === 'breakdowns' ? m.woCount : mode === 'downtime' ? m.downtimeHours : m.cost,
    severity: m.severity,
  }));

  // Each row needs ~38px to keep 10 long machine names legible without
  // crowding — a fixed height clipped/overlapped labels once more than a
  // handful of machines were returned.
  const chartHeight = Math.max(280, chartData.length * 38 + 40);

  return (
    <DashboardWidget
      title="Top 10 Problem Machines"
      loading={loading}
      error={error}
      onRetry={refetch}
      action={
        <div className="flex bg-[#0A1628] rounded-md border border-[#1E3A5F] p-0.5">
          {(Object.keys(MODE_CONFIG) as MetricMode[]).map((key) => (
            <button
              key={key}
              onClick={() => setMode(key)}
              className={`px-2.5 py-1 text-xs font-medium rounded-sm transition-colors ${
                mode === key ? 'bg-[#1A56DB] text-white' : 'text-[#8BA3BF] hover:text-[#F0F4F8]'
              }`}
            >
              {MODE_CONFIG[key].label}
            </button>
          ))}
        </div>
      }
    >
      {chartData.length === 0 ? (
        <EmptyState message="No problem machine data" />
      ) : (
        <div style={{ height: chartHeight }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 56, bottom: 4, left: 8 }} barCategoryGap="28%">
              <CartesianGrid {...CHART_DEFAULTS.cartesianGrid} horizontal={false} />
              <XAxis {...CHART_DEFAULTS.xAxis} type="number" tickFormatter={format} />
              <YAxis
                {...CHART_DEFAULTS.yAxis}
                dataKey="name"
                type="category"
                width={168}
                interval={0}
                tick={{ fill: '#F0F4F8', fontSize: 12 }}
              />
              <Tooltip {...CHART_DEFAULTS.tooltip} formatter={(value: number) => [format(value), MODE_CONFIG[mode].label]} />
              <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={22}>
                {chartData.map((entry, idx) => (
                  <Cell
                    key={idx}
                    fill={SEVERITY_COLORS[entry.severity] ?? SEVERITY_COLORS.low}
                  />
                ))}
                <LabelList
                  dataKey="value"
                  position="right"
                  formatter={(value: number) => format(value)}
                  style={{ fill: '#F0F4F8', fontSize: 11, fontWeight: 600 }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </DashboardWidget>
  );
}
