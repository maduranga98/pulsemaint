import { useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import DashboardWidget from '../shared/DashboardWidget';
import { useDashboardStore } from '../../../store/dashboard.store';
import { CHART_COLORS } from '../../../constants/chartTheme';
import EmptyState from '../shared/EmptyState';

type ToggleMode = 'type' | 'severity' | 'department';

interface BreakdownByTypeChartProps {
  companyId: string;
}

export default function BreakdownByTypeChart({}: BreakdownByTypeChartProps) {
  const [mode, setMode] = useState<ToggleMode>('type');
  const monthly = useDashboardStore((s) => s.monthlyAnalytics);
  const loading = useDashboardStore((s) => s.analyticsLoading);

  const data =
    mode === 'type'
      ? Object.entries(monthly?.breakdownByType ?? {}).map(([name, value]) => ({ name, value }))
      : mode === 'severity'
        ? Object.entries(monthly?.breakdownBySeverity ?? {}).map(([name, value]) => ({ name, value }))
        : []; // department not in monthly schema

  const total = data.reduce((sum, d) => sum + d.value, 0);

  return (
    <DashboardWidget
      title="Breakdown Distribution"
      loading={loading}
      action={
        <div className="flex bg-[#0A1628] rounded-md border border-[#1E3A5F]">
          {(['type', 'severity', 'department'] as ToggleMode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-2 py-0.5 text-[10px] font-medium rounded-sm capitalize ${
                mode === m ? 'bg-[#1A56DB] text-white' : 'text-[#8BA3BF]'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      }
    >
      {data.length === 0 ? (
        <EmptyState message="No breakdown data" />
      ) : (
        <div className="flex flex-col items-center">
          <div className="w-full h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={70}
                  paddingAngle={3}
                  stroke="none"
                >
                  {data.map((_, idx) => (
                    <Cell key={idx} fill={CHART_COLORS.breakdown_types[idx % CHART_COLORS.breakdown_types.length]} />
                  ))}
                </Pie>
                <Tooltip {...CHART_DEFAULTS.tooltip} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="w-full mt-2 space-y-1">
            {data.map((d, idx) => (
              <div key={d.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: CHART_COLORS.breakdown_types[idx % CHART_COLORS.breakdown_types.length] }}
                  />
                  <span className="text-[#8BA3BF] capitalize">{d.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[#F0F4F8] font-medium">{d.value}</span>
                  <span className="text-[#8BA3BF] text-[10px]">
                    {total > 0 ? Math.round((d.value / total) * 100) : 0}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </DashboardWidget>
  );
}

const CHART_DEFAULTS = {
  tooltip: {
    contentStyle: {
      backgroundColor: '#0F1E35',
      border: '1px solid #1E3A5F',
      borderRadius: '8px',
      fontFamily: 'DM Sans',
    },
    labelStyle: { color: '#F0F4F8' },
    itemStyle: { color: '#F0F4F8' },
  },
};
