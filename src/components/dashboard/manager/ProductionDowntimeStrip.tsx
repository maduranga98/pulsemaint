import { Area, AreaChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import DashboardWidget from '../shared/DashboardWidget';
import { useDashboardStore } from '../../../store/dashboard.store';
import { useTopProblemMachines } from '../../../hooks/dashboard/useTopProblemMachines';
import { CHART_DEFAULTS } from '../../../constants/chartTheme';
import { useTranslation } from 'react-i18next';
import { getCompanyCurrency } from '@/lib/currency';

interface ProductionDowntimeStripProps {
  companyId: string;
  months: string[];
}

/** Production hours lost this period, with the machines that lost the most hours drawn as a labelled area chart. */
export default function ProductionDowntimeStrip({ companyId, months }: ProductionDowntimeStripProps) {
  const { t } = useTranslation();
  const monthly = useDashboardStore((s) => s.monthlyAnalytics);
  const loading = useDashboardStore((s) => s.analyticsLoading);
  const { data } = useTopProblemMachines(companyId, months);

  const hours = monthly?.totalProductionHoursLost ?? 0;
  const h = Math.floor(hours);
  const m = Math.floor((hours - h) * 60);
  // Each machine's own Downtime Cost rate × its downtime hours — not a flat per-hour guess.
  const downtimeCost = monthly?.totalDowntimeCost ?? 0;

  const rows = (data?.topProblemMachines ?? [])
    .filter((x) => x.downtimeHours > 0)
    .sort((a, b) => b.downtimeHours - a.downtimeHours)
    .slice(0, 6)
    .map((x) => ({ name: x.machineName, hours: Number(x.downtimeHours.toFixed(1)) }));

  return (
    <DashboardWidget title={t('common.widgets.productionDowntimeStrip.title')} loading={loading}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-[#8BA3BF]">{t('common.widgets.productionDowntimeStrip.hoursLost')}</p>
          <p className="text-4xl font-bold text-[#EF4444]">{h}h {m}m</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-[#8BA3BF]">{t('common.widgets.productionDowntimeStrip.downtimeCost')}</p>
          <p className="text-lg font-semibold text-[#F0F4F8]">{getCompanyCurrency()} {downtimeCost.toLocaleString()}</p>
        </div>
      </div>
      {rows.length > 0 && (
        <div className="mt-3 h-56">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={rows} margin={{ top: 22, right: 24, left: 4, bottom: 4 }}>
              <CartesianGrid {...CHART_DEFAULTS.cartesianGrid} vertical={false} />
              <XAxis {...CHART_DEFAULTS.xAxis} dataKey="name" interval={0} padding={{ left: 24, right: 24 }} />
              <YAxis {...CHART_DEFAULTS.yAxis} width={44} />
              <Tooltip {...CHART_DEFAULTS.tooltip} formatter={(v) => [`${v} h`, t('common.widgets.productionDowntimeStrip.hoursLost')]} />
              <Area type="monotone" dataKey="hours" stroke="#EF4444" strokeWidth={2.5} fill="#EF4444" fillOpacity={0.3}
                dot={{ r: 4, fill: '#0F1E35', stroke: '#EF4444', strokeWidth: 2 }}>
                <LabelList dataKey="hours" position="top" offset={10} formatter={(v) => `${v}h`} style={{ fill: '#F0F4F8', fontSize: 11, fontWeight: 600 }} />
              </Area>
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </DashboardWidget>
  );
}
