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
} from 'recharts';
import DashboardWidget from '../shared/DashboardWidget';
import { useTopProblemMachines } from '../../../hooks/dashboard/useTopProblemMachines';
import { CHART_DEFAULTS } from '../../../constants/chartTheme';
import EmptyState from '../shared/EmptyState';

type MetricMode = 'breakdowns' | 'downtime' | 'cost';

const CRITICALITY_COLORS = ['#10B981', '#EAB308', '#F59E0B', '#F97316', '#EF4444'];

interface TopProblemMachinesChartProps {
  companyId: string;
  month: string;
}

export default function TopProblemMachinesChart({ companyId, month }: TopProblemMachinesChartProps) {
  const [mode, setMode] = useState<MetricMode>('breakdowns');
  const { data, loading, error, refetch } = useTopProblemMachines(companyId, month);

  const machines = data?.topProblemMachines?.slice(0, 10) ?? [];

  const chartData = machines.map((m) => ({
    name: m.machineName,
    value: mode === 'breakdowns' ? m.breakdownCount : mode === 'downtime' ? m.downtimeHours : m.cost,
    criticality: m.criticality,
  }));

  // dataKey for tooltip reference

  return (
    <DashboardWidget
      title="Top 10 Problem Machines"
      loading={loading}
      error={error}
      onRetry={refetch}
      action={
        <div className="flex bg-[#0A1628] rounded-md border border-[#1E3A5F]">
          {([
            { key: 'breakdowns', label: 'Count' },
            { key: 'downtime', label: 'Hours' },
            { key: 'cost', label: 'Cost' },
          ] as { key: MetricMode; label: string }[]).map((m) => (
            <button
              key={m.key}
              onClick={() => setMode(m.key)}
              className={`px-2 py-0.5 text-[10px] font-medium rounded-sm ${
                mode === m.key ? 'bg-[#1A56DB] text-white' : 'text-[#8BA3BF]'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      }
    >
      {chartData.length === 0 ? (
        <EmptyState message="No problem machine data" />
      ) : (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid {...CHART_DEFAULTS.cartesianGrid} />
              <XAxis {...CHART_DEFAULTS.xAxis} type="number" />
              <YAxis
                {...CHART_DEFAULTS.yAxis}
                dataKey="name"
                type="category"
                width={100}
                tick={{ fontSize: 10 }}
              />
              <Tooltip {...CHART_DEFAULTS.tooltip} />
              <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                {chartData.map((entry, idx) => (
                  <Cell
                    key={idx}
                    fill={CRITICALITY_COLORS[Math.min(entry.criticality - 1, 4)]}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </DashboardWidget>
  );
}
