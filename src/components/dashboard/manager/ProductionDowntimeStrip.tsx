import { useEffect, useState } from 'react';
import { Area, AreaChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import DashboardWidget from '../shared/DashboardWidget';
import { useDashboardStore } from '../../../store/dashboard.store';
import { computeDowntimeCostSeries, type DowntimeCostPoint } from '../../../services/analyticsAggregation';
import { useDepartmentScope } from '../../../hooks/useDepartmentScope';
import { CHART_DEFAULTS } from '../../../constants/chartTheme';
import { useTranslation } from 'react-i18next';
import { getCompanyCurrency } from '@/lib/currency';

interface ProductionDowntimeStripProps {
  companyId: string;
  months: string[];
}

const compact = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}K` : String(Math.round(n)));

/** Production hours lost this period, with the downtime cost drawn against time (per day, or per month on longer ranges). */
export default function ProductionDowntimeStrip({ companyId, months }: ProductionDowntimeStripProps) {
  const { t } = useTranslation();
  const monthly = useDashboardStore((s) => s.monthlyAnalytics);
  const loading = useDashboardStore((s) => s.analyticsLoading);
  const { plantId } = useDepartmentScope();
  const [series, setSeries] = useState<DowntimeCostPoint[]>([]);
  const monthsKey = months.join(',');

  useEffect(() => {
    if (!companyId || months.length === 0) return;
    let alive = true;
    computeDowntimeCostSeries(companyId, months, plantId)
      .then((rows) => alive && setSeries(rows))
      .catch(() => alive && setSeries([]));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, monthsKey, plantId]);

  const hours = monthly?.totalProductionHoursLost ?? 0;
  const h = Math.floor(hours);
  const m = Math.floor((hours - h) * 60);
  // Each machine's own Downtime Cost rate × its downtime hours — not a flat per-hour guess.
  const downtimeCost = monthly?.totalDowntimeCost ?? 0;
  const cur = getCompanyCurrency();

  const daily = months.length === 1;
  const label = (key: string) => {
    const d = new Date(daily ? `${key}T00:00:00` : `${key}-01T00:00:00`);
    return daily ? String(d.getDate()) : d.toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
  };
  const rows = series.map((p) => ({ ...p, label: label(p.key) }));

  return (
    <DashboardWidget title={t('common.widgets.productionDowntimeStrip.title')} loading={loading}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-[#8BA3BF]">{t('common.widgets.productionDowntimeStrip.hoursLost')}</p>
          <p className="text-4xl font-bold text-[#EF4444]">{h}h {m}m</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-[#8BA3BF]">{t('common.widgets.productionDowntimeStrip.downtimeCost')}</p>
          <p className="text-lg font-semibold text-[#F0F4F8]">{cur} {downtimeCost.toLocaleString()}</p>
        </div>
      </div>
      {rows.some((r) => r.cost > 0) && (
        <div className="mt-3 h-60">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={rows} margin={{ top: 22, right: 20, left: 4, bottom: 4 }}>
              <CartesianGrid {...CHART_DEFAULTS.cartesianGrid} vertical={false} />
              <XAxis {...CHART_DEFAULTS.xAxis} dataKey="label" interval={daily ? 'preserveStartEnd' : 0} padding={{ left: 16, right: 16 }} />
              <YAxis {...CHART_DEFAULTS.yAxis} width={64} tickFormatter={(v) => `${cur} ${compact(Number(v))}`} />
              <Tooltip
                {...CHART_DEFAULTS.tooltip}
                labelFormatter={(_, p) => p?.[0]?.payload?.key ?? ''}
                formatter={(v) => [`${cur} ${Number(v ?? 0).toLocaleString()}`, t('common.widgets.productionDowntimeStrip.downtimeCost')]}
              />
              <Area
                type="monotone"
                dataKey="cost"
                stroke="#EF4444"
                strokeWidth={2.5}
                fill="#EF4444"
                fillOpacity={0.3}
                dot={daily ? false : { r: 4, fill: '#0F1E35', stroke: '#EF4444', strokeWidth: 2 }}
              >
                {!daily && (
                  <LabelList dataKey="cost" position="top" offset={10} formatter={(v) => compact(Number(v ?? 0))} style={{ fill: '#F0F4F8', fontSize: 11, fontWeight: 600 }} />
                )}
              </Area>
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </DashboardWidget>
  );
}
