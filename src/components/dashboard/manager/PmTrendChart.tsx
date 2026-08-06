import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, ResponsiveContainer } from 'recharts';
import DashboardWidget from '../shared/DashboardWidget';
import { usePmTypeDistribution } from '../../../hooks/dashboard/usePmTypeDistribution';
import { PM_TYPE_CONFIG } from '../../../constants/pmConfig';
import { CHART_DEFAULTS } from '../../../constants/chartTheme';
import EmptyState from '../shared/EmptyState';

interface PmTrendChartProps {
  companyId: string;
}

// Graphical view of PM types vs. how many Preventive work orders exist for
// each — replaces the earlier day-by-day completion trend line.
export default function PmTrendChart({ companyId }: PmTrendChartProps) {
  const { data, loading, error, refetch } = usePmTypeDistribution(companyId);

  const total = data.reduce((s, d) => s + d.count, 0);

  const chartData = data.map((d) => {
    const config = PM_TYPE_CONFIG[d.pmType];
    return {
      name: config.label,
      count: d.count,
      pct: total > 0 ? Math.round((d.count / total) * 100) : 0,
      color: config.color,
    };
  });

  return (
    <DashboardWidget title="PM Work Orders by Type" loading={loading} error={error} onRetry={refetch}>
      {chartData.length === 0 ? (
        <EmptyState message="No preventive work order data" />
      ) : (
        <>
          <div style={{ height: Math.max(220, chartData.length * 34 + 40) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 32 }}>
                <CartesianGrid {...CHART_DEFAULTS.cartesianGrid} horizontal={false} />
                <XAxis {...CHART_DEFAULTS.xAxis} type="number" allowDecimals={false} />
                <YAxis
                  {...CHART_DEFAULTS.yAxis}
                  type="category"
                  dataKey="name"
                  width={130}
                  interval={0}
                  tick={{ ...CHART_DEFAULTS.yAxis.tick, fontSize: 11 }}
                />
                <Tooltip
                  {...CHART_DEFAULTS.tooltip}
                  formatter={(value, _name, props: any) => [`${value} (${props.payload.pct}%)`, 'WOs']}
                />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                  {chartData.map((d) => (
                    <Cell key={d.name} fill={d.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-3 pt-3 border-t border-[#1E3A5F]/50 grid grid-cols-2 gap-1 text-xs">
            {chartData.map((d) => (
              <div key={d.name} className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }} />
                  <span className="text-[#8BA3BF] truncate">{d.name}</span>
                </div>
                <span className="text-[#F0F4F8] font-medium ml-2">{d.count}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </DashboardWidget>
  );
}
