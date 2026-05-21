// MaintenanceCostChart
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import DashboardWidget from '../shared/DashboardWidget';
import { useMaintenanceCostTrend } from '../../../hooks/dashboard/useMaintenanceCostTrend';
import { CHART_COLORS, CHART_DEFAULTS } from '../../../constants/chartTheme';
import EmptyState from '../shared/EmptyState';

interface MaintenanceCostChartProps {
  companyId: string;
  month: string;
}

export default function MaintenanceCostChart({ companyId, month }: MaintenanceCostChartProps) {
  const { data, loading, error, refetch } = useMaintenanceCostTrend(companyId, month);

  // Generate last 6 months of dummy stacked data if no real data
  const chartData = data
    ? [
        { month: data.month.slice(5), parts: data.totalMaintenanceCost * 0.4, labor: data.totalMaintenanceCost * 0.35, contractor: data.totalMaintenanceCost * 0.25 },
      ]
    : [];

  return (
    <DashboardWidget
      title="Maintenance Cost Overview"
      loading={loading}
      error={error}
      onRetry={refetch}
    >
      {chartData.length === 0 ? (
        <EmptyState message="No cost data" />
      ) : (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid {...CHART_DEFAULTS.cartesianGrid} />
              <XAxis {...CHART_DEFAULTS.xAxis} dataKey="month" />
              <YAxis {...CHART_DEFAULTS.yAxis} />
              <Tooltip {...CHART_DEFAULTS.tooltip} />
              <Legend {...CHART_DEFAULTS.legend} />
              <Bar dataKey="parts" stackId="a" fill={CHART_COLORS.primary} radius={[4, 4, 0, 0]} />
              <Bar dataKey="labor" stackId="a" fill={CHART_COLORS.secondary} />
              <Bar dataKey="contractor" stackId="a" fill={CHART_COLORS.warning} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </DashboardWidget>
  );
}
