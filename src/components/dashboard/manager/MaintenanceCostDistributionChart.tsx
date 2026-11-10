import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useTranslation } from 'react-i18next';
import DashboardWidget from '../shared/DashboardWidget';
import EmptyState from '../shared/EmptyState';
import { useCostByWoType } from '../../../hooks/dashboard/useCostByWoType';
import { CHART_DEFAULTS } from '../../../constants/chartTheme';
import { WO_TYPE_CONFIG } from '../../../constants/woConfig';
import type { WOType } from '../../../types/workOrder';
import { getCompanyCurrency } from '@/lib/currency';

const PALETTE = ['#1A56DB', '#22D3EE', '#10B981', '#F59E0B', '#EF4444', '#9085e9', '#d55181', '#8BA3BF'];
const compact = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}K` : String(Math.round(n)));

/** Maintenance cost by work-order type as ranked horizontal bars with the cost written on each row. */
export default function MaintenanceCostDistributionChart({ companyId, month }: { companyId: string; month: string | string[] }) {
  const { t } = useTranslation();
  const { data, loading, error, refetch } = useCostByWoType(companyId, month);
  const rows = data.map((r) => ({
    name: WO_TYPE_CONFIG[r.woType as WOType] ? t(`common.workOrders.types.${r.woType}`) : r.woType,
    cost: Math.round(r.cost),
  })).sort((a, b) => b.cost - a.cost);
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
          <div style={{ height: Math.max(200, rows.length * 52 + 40) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 92, left: 8, bottom: 4 }} barCategoryGap="22%">
                <CartesianGrid {...CHART_DEFAULTS.cartesianGrid} horizontal={false} />
                <XAxis {...CHART_DEFAULTS.xAxis} type="number" tickFormatter={(v) => compact(Number(v))} />
                <YAxis {...CHART_DEFAULTS.yAxis} type="category" dataKey="name" width={120} interval={0} tick={{ fill: '#F0F4F8', fontSize: 12 }} />
                <Tooltip
                  {...CHART_DEFAULTS.tooltip}
                  cursor={{ fill: '#142849' }}
                  formatter={(v) => [`${cur} ${Number(v ?? 0).toLocaleString()}`, t('common.widgets.maintenanceCostChart.cost')]}
                />
                <Bar dataKey="cost" radius={[0, 8, 8, 0]} maxBarSize={34}>
                  {rows.map((r, i) => <Cell key={r.name} fill={PALETTE[i % PALETTE.length]} />)}
                  <LabelList dataKey="cost" position="right" formatter={(v) => `${cur} ${Number(v ?? 0).toLocaleString()}`}
                    style={{ fill: '#F0F4F8', fontSize: 12, fontWeight: 700 }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 pt-3 border-t border-[#1E3A5F]/50 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-xs">
            {rows.map((r, i) => (
              <div key={r.name} className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-[#8BA3BF]">
                  <span className="h-2 w-2 rounded-full" style={{ background: PALETTE[i % PALETTE.length] }} />{r.name}
                </span>
                <span className="font-medium text-[#F0F4F8]">{cur} {r.cost.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </DashboardWidget>
  );
}
