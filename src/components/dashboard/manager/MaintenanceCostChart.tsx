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
import { useTranslation } from 'react-i18next';

interface MaintenanceCostChartProps {
  companyId: string;
  month: string | string[];
}

export default function MaintenanceCostChart({ companyId, month }: MaintenanceCostChartProps) {
  const { t } = useTranslation();
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
      title={t('common.widgets.maintenanceCostChart.title')}
      loading={loading}
      error={error}
      onRetry={refetch}
    >
      {chartData.length === 0 ? (
        <EmptyState message={t('common.widgets.maintenanceCostChart.empty')} />
      ) : (
        <>
          <p className="text-xs text-[#8BA3BF] mb-2">
            {t('common.widgets.maintenanceCostChart.totalThisMonth')} <span className="text-[#F0F4F8] font-semibold">LKR {totalCost.toLocaleString()}</span>
          </p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid {...CHART_DEFAULTS.cartesianGrid} />
                <XAxis
                  {...CHART_DEFAULTS.xAxis}
                  dataKey="name"
                  tick={{ ...CHART_DEFAULTS.xAxis.tick, fontSize: 11 }}
                  interval={0}
                  angle={-15}
                  textAnchor="end"
                  height={50}
                />
                <YAxis {...CHART_DEFAULTS.yAxis} tick={{ ...CHART_DEFAULTS.yAxis.tick, fontSize: 11 }} />
                <Tooltip
                  {...CHART_DEFAULTS.tooltip}
                  formatter={(val) => [`LKR ${Number(val ?? 0).toLocaleString()}`, t('common.widgets.maintenanceCostChart.cost')]}
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
