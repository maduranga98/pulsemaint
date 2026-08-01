// MaintenanceCostChart
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
import { useCostByWoType } from '../../../hooks/dashboard/useCostByWoType';
import { CHART_DEFAULTS } from '../../../constants/chartTheme';
import { WO_TYPE_CONFIG } from '../../../constants/woConfig';
import type { WOType } from '../../../types/workOrder';
import EmptyState from '../shared/EmptyState';

interface MaintenanceCostChartProps {
  companyId: string;
  month: string | string[];
}

export default function MaintenanceCostChart({ companyId, month }: MaintenanceCostChartProps) {
  const { data, loading, error, refetch } = useCostByWoType(companyId, month);

  const chartData = data.map((row) => {
    const config = WO_TYPE_CONFIG[row.woType as WOType];
    return {
      name: config?.label ?? row.woType,
      cost: row.cost,
      color: config?.color ?? '#8BA3BF',
    };
  });
  const totalCost = data.reduce((s, row) => s + row.cost, 0);

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
        <>
          <p className="text-xs text-[#8BA3BF] mb-2">
            Total this month: <span className="text-[#F0F4F8] font-semibold">LKR {totalCost.toLocaleString()}</span>
          </p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid {...CHART_DEFAULTS.cartesianGrid} />
                <XAxis {...CHART_DEFAULTS.xAxis} dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-15} textAnchor="end" height={50} />
                <YAxis {...CHART_DEFAULTS.yAxis} />
                <Tooltip
                  {...CHART_DEFAULTS.tooltip}
                  formatter={(val: number) => [`LKR ${val.toLocaleString()}`, 'Cost']}
                />
                <Bar dataKey="cost" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry, idx) => (
                    <Cell key={idx} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </DashboardWidget>
  );
}
