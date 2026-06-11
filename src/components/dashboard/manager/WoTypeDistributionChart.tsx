import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, ResponsiveContainer } from 'recharts';
import DashboardWidget from '../shared/DashboardWidget';
import { useWoTypeDistribution } from '../../../hooks/dashboard/useWoTypeDistribution';
import { CHART_DEFAULTS, CHART_COLORS } from '../../../constants/chartTheme';
import EmptyState from '../shared/EmptyState';

const WO_TYPE_LABELS: Record<string, string> = {
  BREAKDOWN: 'Breakdown (CM)',
  CORRECTIVE: 'Corrective',
  PREVENTIVE: 'Preventive (PM)',
  INSTALLATION: 'Installation',
  MODIFICATION: 'Modification',
  INSPECTION: 'Inspection',
  CONTRACTOR: 'Contractor',
  OTHER: 'Other',
};

interface WoTypeDistributionChartProps {
  companyId: string;
}

export default function WoTypeDistributionChart({ companyId }: WoTypeDistributionChartProps) {
  const { data, loading, error, refetch } = useWoTypeDistribution(companyId);

  const total = data.reduce((s, d) => s + d.count, 0);

  const chartData = data.map((d) => ({
    name: WO_TYPE_LABELS[d.type] ?? d.type,
    count: d.count,
    pct: total > 0 ? Math.round((d.count / total) * 100) : 0,
  }));

  return (
    <DashboardWidget
      title="Work Order Distribution by Type"
      loading={loading}
      error={error}
      onRetry={refetch}
    >
      {chartData.length === 0 ? (
        <EmptyState message="No work order data" />
      ) : (
        <>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 32 }}>
                <CartesianGrid {...CHART_DEFAULTS.cartesianGrid} horizontal={false} />
                <XAxis {...CHART_DEFAULTS.xAxis} type="number" allowDecimals={false} />
                <YAxis
                  {...CHART_DEFAULTS.yAxis}
                  type="category"
                  dataKey="name"
                  width={110}
                  tick={{ ...CHART_DEFAULTS.yAxis.tick, fontSize: 10 }}
                />
                <Tooltip
                  {...CHART_DEFAULTS.tooltip}
                  formatter={(value: number, _name: string, props: any) => [
                    `${value} (${props.payload.pct}%)`,
                    'WOs',
                  ]}
                />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                  {chartData.map((_, idx) => (
                    <Cell
                      key={idx}
                      fill={CHART_COLORS.breakdown_types[idx % CHART_COLORS.breakdown_types.length]}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-3 pt-3 border-t border-[#1E3A5F]/50 grid grid-cols-2 gap-1 text-xs">
            {chartData.map((d, idx) => (
              <div key={d.name} className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{
                      backgroundColor:
                        CHART_COLORS.breakdown_types[idx % CHART_COLORS.breakdown_types.length],
                    }}
                  />
                  <span className="text-[#8BA3BF] truncate">{d.name}</span>
                </div>
                <span className="text-[#F0F4F8] font-medium ml-2">{d.pct}%</span>
              </div>
            ))}
          </div>
        </>
      )}
    </DashboardWidget>
  );
}
