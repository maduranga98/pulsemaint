import { Area, AreaChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useTranslation } from 'react-i18next';
import DashboardWidget from '../shared/DashboardWidget';
import EmptyState from '../shared/EmptyState';
import { useCostByWoType } from '../../../hooks/dashboard/useCostByWoType';
import { CHART_DEFAULTS } from '../../../constants/chartTheme';
import { WO_TYPE_CONFIG } from '../../../constants/woConfig';
import type { WOType } from '../../../types/workOrder';
import { getCompanyCurrency } from '@/lib/currency';

const compact = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}K` : String(Math.round(n)));

/** Maintenance cost by work-order type as a filled curve, with the cost written on each point. */
export default function MaintenanceCostDistributionChart({ companyId, month }: { companyId: string; month: string | string[] }) {
  const { t } = useTranslation();
  const { data, loading, error, refetch } = useCostByWoType(companyId, month);
  const rows = data.map((r) => ({
    name: WO_TYPE_CONFIG[r.woType as WOType] ? t(`common.workOrders.types.${r.woType}`) : r.woType,
    cost: Math.round(r.cost),
  }));
  const total = rows.reduce((s, r) => s + r.cost, 0);
  const cur = getCompanyCurrency();

  return (
    <DashboardWidget
      title={t('common.widgets.maintenanceCostDistribution.title', { defaultValue: 'Maintenance Cost Distribution' })}
      loading={loading}
      error={error}
      onRetry={refetch}
    >
      {rows.length === 0 ? (
        <EmptyState message={t('common.widgets.maintenanceCostChart.empty')} />
      ) : (
        <>
          <p className="text-xs text-[#8BA3BF] mb-2">
            {t('common.widgets.maintenanceCostChart.totalThisMonth')}{' '}
            <span className="text-[#F0F4F8] font-semibold">{cur} {total.toLocaleString()}</span>
          </p>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={rows} margin={{ top: 24, right: 24, left: 4, bottom: 4 }}>
                <CartesianGrid {...CHART_DEFAULTS.cartesianGrid} vertical={false} />
                <XAxis {...CHART_DEFAULTS.xAxis} dataKey="name" interval={0} padding={{ left: 24, right: 24 }} />
                <YAxis {...CHART_DEFAULTS.yAxis} tickFormatter={(v) => compact(Number(v))} width={48} />
                <Tooltip
                  {...CHART_DEFAULTS.tooltip}
                  formatter={(v) => [`${cur} ${Number(v ?? 0).toLocaleString()}`, t('common.widgets.maintenanceCostChart.cost')]}
                />
                <Area type="monotone" dataKey="cost" stroke="#22D3EE" strokeWidth={2.5} fill="#22D3EE" fillOpacity={0.35}
                  dot={{ r: 4, fill: '#0F1E35', stroke: '#22D3EE', strokeWidth: 2 }} isAnimationActive>
                  <LabelList dataKey="cost" position="top" offset={10} formatter={(v) => compact(Number(v ?? 0))}
                    style={{ fill: '#F0F4F8', fontSize: 11, fontWeight: 600 }} />
                </Area>
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </DashboardWidget>
  );
}
