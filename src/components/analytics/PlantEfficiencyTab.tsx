import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Bar, BarChart, CartesianGrid, Cell, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Activity, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { usePlants } from '@/hooks/usePlants';
import { useDepartmentScope } from '@/hooks/useDepartmentScope';
import { computePlantEfficiency, type PlantEfficiency, type PlantEfficiencyFigures } from '@/services/analyticsAggregation';
import { CHART_DEFAULTS } from '@/constants/chartTheme';
import DashboardWidget from '@/components/dashboard/shared/DashboardWidget';
import EmptyState from '@/components/dashboard/shared/EmptyState';

// Categorical hues for plants, validated for the dark surface (#0F1E35):
// lightness band, CVD separation and 3:1 contrast all pass. Assigned in the
// plants' fixed order, so a plant keeps its colour whatever is filtered.
const PLANT_COLORS = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767'];
const UNASSIGNED_COLOR = '#8BA3BF';
// Two-series charts (breakdowns vs work orders) use slots 1 and 2.
const SERIES = { breakdowns: PLANT_COLORS[1], workOrders: PLANT_COLORS[0] };

type Metric = keyof PlantEfficiencyFigures;

interface Props {
  /** Analytics scope id (companyId / siteId) the operational data is stored under. */
  companyId: string;
  months: string[];
}

function healthStatus(score: number | null): { key: 'good' | 'watch' | 'poor' | 'none'; tone: string; Icon: typeof Activity } {
  if (score == null) return { key: 'none', tone: 'text-[#8BA3BF] border-[#1E3A5F]', Icon: Activity };
  if (score >= 80) return { key: 'good', tone: 'text-emerald-300 border-emerald-700/60 bg-emerald-900/20', Icon: CheckCircle2 };
  if (score >= 60) return { key: 'watch', tone: 'text-amber-300 border-amber-700/60 bg-amber-900/20', Icon: Activity };
  return { key: 'poor', tone: 'text-red-300 border-red-700/60 bg-red-900/20', Icon: AlertTriangle };
}

/**
 * Analytics → Plant efficiency: maintenance / breakdown cost, downtime,
 * breakdown and work-order counts and factory (machine) health per plant.
 * "Compare plants" shows every plant side by side (one chart per measure,
 * never two scales on one axis); each plant tab shows its monthly trend.
 */
export default function PlantEfficiencyTab({ companyId, months }: Props) {
  const { t } = useTranslation();
  const userProfile = useAuthStore((s) => s.userProfile);
  const currency = useAuthStore((s) => s.company?.currency ?? 'LKR');
  const { plants } = usePlants(userProfile?.companyId ?? '');
  const { plantId: scopedPlantId } = useDepartmentScope();
  const isAdmin = userProfile?.role === 'admin';
  // Plant-scoped roles (e.g. plant manager) only ever see their own plant.
  const lockedPlantId = !isAdmin ? scopedPlantId : null;

  const [data, setData] = useState<PlantEfficiency[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string>(lockedPlantId ?? (isAdmin && scopedPlantId ? scopedPlantId : 'compare'));
  const monthsKey = months.join(',');

  useEffect(() => {
    if (!companyId) return;
    let alive = true;
    setData(null);
    setError(null);
    computePlantEfficiency(companyId, months)
      .then((rows) => alive && setData(rows))
      .catch(() => alive && setError(t('common.analytics.plantEfficiency.loadFailed')));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, monthsKey]);

  // Follow the admin's plant switcher in the header.
  useEffect(() => {
    if (lockedPlantId) setSelected(lockedPlantId);
    else if (isAdmin) setSelected(scopedPlantId ?? 'compare');
  }, [lockedPlantId, isAdmin, scopedPlantId]);

  const plantOrder = useMemo(() => [...plants].sort((a, b) => a.name.localeCompare(b.name)), [plants]);
  const nameOf = (id: string | null) => (id ? plantOrder.find((p) => p.id === id)?.name ?? id : t('common.analytics.plantEfficiency.unassigned'));
  const colorOf = (id: string | null) => {
    if (!id) return UNASSIGNED_COLOR;
    const i = plantOrder.findIndex((p) => p.id === id);
    return i >= 0 ? PLANT_COLORS[i % PLANT_COLORS.length] : UNASSIGNED_COLOR;
  };

  const rows = useMemo(() => {
    if (!data) return [];
    const list = data.filter((p) => (lockedPlantId ? p.plantId === lockedPlantId : true));
    // Plants first in their fixed order, "no plant" last — and only when it has something.
    return list
      .filter((p) => p.plantId !== null || p.machineCount > 0 || p.totals.breakdowns > 0 || p.totals.workOrders > 0)
      .sort((a, b) => (a.plantId === null ? 1 : b.plantId === null ? -1 : nameOf(a.plantId).localeCompare(nameOf(b.plantId))));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, lockedPlantId, plantOrder]);

  const money = (n: number) => `${currency} ${Math.round(n).toLocaleString()}`;
  const compact = (n: number) => `${currency} ${n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}K` : Math.round(n)}`;
  const metricLabel = (m: Metric) => t(`common.analytics.plantEfficiency.metrics.${m}`);
  const fmt = (m: Metric, v: number) => (m === 'maintenanceCost' || m === 'downtimeCost' ? money(v) : m === 'downtimeHours' ? `${v} h` : v.toLocaleString());

  const tabs = lockedPlantId
    ? [{ id: lockedPlantId, label: nameOf(lockedPlantId) }]
    : [{ id: 'compare', label: t('common.analytics.plantEfficiency.compare') }, ...rows.map((r) => ({ id: r.plantId ?? '__none__', label: nameOf(r.plantId) }))];
  const current = selected === 'compare' ? null : rows.find((r) => (r.plantId ?? '__none__') === selected) ?? null;

  if (error) return <DashboardWidget title={t('common.analytics.plantEfficiency.title')} error={error}><span /></DashboardWidget>;
  if (!data) return <DashboardWidget title={t('common.analytics.plantEfficiency.title')} loading><span /></DashboardWidget>;
  if (rows.length === 0) {
    return <DashboardWidget title={t('common.analytics.plantEfficiency.title')}><EmptyState message={t('common.analytics.plantEfficiency.empty')} /></DashboardWidget>;
  }

  return (
    <div className="space-y-4">
      {/* Plant tabs */}
      <div className="flex flex-wrap gap-1.5" role="tablist">
        {tabs.map((tb) => (
          <button
            key={tb.id}
            role="tab"
            aria-selected={selected === tb.id}
            onClick={() => setSelected(tb.id)}
            className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              selected === tb.id ? 'bg-[#1A56DB] text-white' : 'border border-[#1E3A5F] bg-[#0F1E35] text-[#8BA3BF] hover:text-[#F0F4F8]'
            }`}
          >
            {tb.id !== 'compare' && <span className="h-2.5 w-2.5 rounded-sm" style={{ background: colorOf(tb.id === '__none__' ? null : tb.id) }} />}
            {tb.label}
          </button>
        ))}
      </div>

      {current ? (
        <PlantDetail plant={current} name={nameOf(current.plantId)} color={colorOf(current.plantId)} fmt={fmt} compact={compact} metricLabel={metricLabel} />
      ) : (
        <PlantComparison rows={rows} nameOf={nameOf} colorOf={colorOf} fmt={fmt} compact={compact} metricLabel={metricLabel} />
      )}
    </div>
  );
}

interface SharedFormat {
  fmt: (m: Metric, v: number) => string;
  compact: (n: number) => string;
  metricLabel: (m: Metric) => string;
}

function HealthBadge({ score }: { score: number | null }) {
  const { t } = useTranslation();
  const s = healthStatus(score);
  return (
    <span className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs font-semibold ${s.tone}`}>
      <s.Icon className="h-3.5 w-3.5" />
      {score ?? '—'}
      <span className="font-normal">{t(`common.analytics.plantEfficiency.health.${s.key}`)}</span>
    </span>
  );
}

export function PlantComparison({
  rows, nameOf, colorOf, fmt, compact, metricLabel,
}: SharedFormat & { rows: PlantEfficiency[]; nameOf: (id: string | null) => string; colorOf: (id: string | null) => string }) {
  const { t } = useTranslation();
  const chartRows = rows.map((r) => ({ name: nameOf(r.plantId), color: colorOf(r.plantId), health: r.healthScore ?? 0, ...r.totals }));
  const metrics: Metric[] = ['maintenanceCost', 'downtimeHours', 'breakdowns', 'workOrders'];

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        {metrics.map((m) => (
          <DashboardWidget key={m} title={metricLabel(m)}>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartRows} barCategoryGap="30%">
                  <CartesianGrid {...CHART_DEFAULTS.cartesianGrid} vertical={false} />
                  <XAxis {...CHART_DEFAULTS.xAxis} dataKey="name" interval={0} />
                  <YAxis {...CHART_DEFAULTS.yAxis} tickFormatter={(v) => (m === 'maintenanceCost' ? compact(Number(v)) : String(v))} width={m === 'maintenanceCost' ? 72 : 40} allowDecimals={m === 'downtimeHours'} />
                  <Tooltip {...CHART_DEFAULTS.tooltip} cursor={{ fill: '#142849' }} formatter={(v) => [fmt(m, Number(v ?? 0)), metricLabel(m)]} />
                  <Bar dataKey={m} radius={[4, 4, 0, 0]} maxBarSize={56}>
                    {chartRows.map((r) => <Cell key={r.name} fill={r.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </DashboardWidget>
        ))}
      </div>

      <DashboardWidget title={t('common.analytics.plantEfficiency.health.title')}>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartRows} layout="vertical" margin={{ left: 8, right: 24 }}>
              <CartesianGrid {...CHART_DEFAULTS.cartesianGrid} horizontal={false} />
              <XAxis {...CHART_DEFAULTS.xAxis} type="number" domain={[0, 100]} />
              <YAxis {...CHART_DEFAULTS.yAxis} type="category" dataKey="name" width={110} />
              <Tooltip {...CHART_DEFAULTS.tooltip} cursor={{ fill: '#142849' }} formatter={(v) => [`${v} / 100`, t('common.analytics.plantEfficiency.health.title')]} />
              <Bar dataKey="health" radius={[0, 4, 4, 0]} maxBarSize={22}>
                {chartRows.map((r) => <Cell key={r.name} fill={r.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </DashboardWidget>

      {/* Table view: the same numbers, readable without the charts. */}
      <DashboardWidget title={t('common.analytics.plantEfficiency.table')}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-[#8BA3BF]">
              <tr>
                <th className="py-2 pr-3">{t('common.analytics.plantEfficiency.plant')}</th>
                <th className="py-2 pr-3">{t('common.analytics.plantEfficiency.health.title')}</th>
                {(['maintenanceCost', 'downtimeHours', 'downtimeCost', 'breakdowns', 'workOrders'] as Metric[]).map((m) => (
                  <th key={m} className="py-2 pr-3 text-right">{metricLabel(m)}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E3A5F] text-[#F0F4F8]">
              {rows.map((r) => (
                <tr key={r.plantId ?? 'none'}>
                  <td className="py-2 pr-3">
                    <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: colorOf(r.plantId) }} />{nameOf(r.plantId)}</span>
                    <p className="text-xs text-[#8BA3BF]">{t('common.analytics.plantEfficiency.machines', { count: r.machineCount })}</p>
                  </td>
                  <td className="py-2 pr-3"><HealthBadge score={r.healthScore} /></td>
                  {(['maintenanceCost', 'downtimeHours', 'downtimeCost', 'breakdowns', 'workOrders'] as Metric[]).map((m) => (
                    <td key={m} className="py-2 pr-3 text-right tabular-nums">{fmt(m, r.totals[m])}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DashboardWidget>
    </div>
  );
}

export function PlantDetail({ plant, name, color, fmt, compact, metricLabel }: SharedFormat & { plant: PlantEfficiency; name: string; color: string }) {
  const { t } = useTranslation();
  const monthLabel = (mk: string) => new Date(`${mk}-01T00:00:00`).toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
  const trend = plant.months.map((m) => ({ ...m, label: monthLabel(m.month) }));
  const tiles: Metric[] = ['maintenanceCost', 'downtimeHours', 'downtimeCost', 'breakdowns', 'workOrders'];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <div className="rounded-xl border border-[#1E3A5F] bg-[#0F1E35] p-4">
          <p className="text-xs text-[#8BA3BF]">{t('common.analytics.plantEfficiency.health.title')}</p>
          <p className="mt-1 text-3xl font-bold text-[#F0F4F8]">{plant.healthScore ?? '—'}<span className="text-sm font-normal text-[#8BA3BF]"> / 100</span></p>
          <div className="mt-1"><HealthBadge score={plant.healthScore} /></div>
          <p className="mt-1 text-xs text-[#8BA3BF]">{t('common.analytics.plantEfficiency.machines', { count: plant.machineCount })}</p>
        </div>
        {tiles.map((m) => (
          <div key={m} className="rounded-xl border border-[#1E3A5F] bg-[#0F1E35] p-4">
            <p className="text-xs text-[#8BA3BF]">{metricLabel(m)}</p>
            <p className="mt-1 text-2xl font-bold text-[#F0F4F8] tabular-nums">{fmt(m, plant.totals[m])}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <DashboardWidget title={`${metricLabel('maintenanceCost')} · ${name}`}>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trend}>
                <CartesianGrid {...CHART_DEFAULTS.cartesianGrid} vertical={false} />
                <XAxis {...CHART_DEFAULTS.xAxis} dataKey="label" />
                <YAxis {...CHART_DEFAULTS.yAxis} tickFormatter={(v) => compact(Number(v))} width={72} />
                <Tooltip {...CHART_DEFAULTS.tooltip} cursor={{ fill: '#142849' }} formatter={(v) => [fmt('maintenanceCost', Number(v ?? 0)), metricLabel('maintenanceCost')]} />
                <Bar dataKey="maintenanceCost" fill={color} radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </DashboardWidget>
        <DashboardWidget title={`${metricLabel('downtimeHours')} · ${name}`}>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trend}>
                <CartesianGrid {...CHART_DEFAULTS.cartesianGrid} vertical={false} />
                <XAxis {...CHART_DEFAULTS.xAxis} dataKey="label" />
                <YAxis {...CHART_DEFAULTS.yAxis} width={40} />
                <Tooltip {...CHART_DEFAULTS.tooltip} cursor={{ fill: '#142849' }} formatter={(v) => [fmt('downtimeHours', Number(v ?? 0)), metricLabel('downtimeHours')]} />
                <Bar dataKey="downtimeHours" fill={color} radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </DashboardWidget>
        <DashboardWidget title={t('common.analytics.plantEfficiency.countsTitle', { plant: name })} className="lg:col-span-2">
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trend} barGap={2} barCategoryGap="28%">
                <CartesianGrid {...CHART_DEFAULTS.cartesianGrid} vertical={false} />
                <XAxis {...CHART_DEFAULTS.xAxis} dataKey="label" />
                <YAxis {...CHART_DEFAULTS.yAxis} width={40} allowDecimals={false} />
                <Tooltip {...CHART_DEFAULTS.tooltip} cursor={{ fill: '#142849' }} />
                {/* Legend text stays in text ink; the swatch carries the series colour. */}
                <Legend wrapperStyle={{ fontSize: 12 }} formatter={(value) => <span style={{ color: '#B8C7DB' }}>{value}</span>} />
                <Bar dataKey="breakdowns" name={metricLabel('breakdowns')} fill={SERIES.breakdowns} radius={[4, 4, 0, 0]} maxBarSize={28} />
                <Bar dataKey="workOrders" name={metricLabel('workOrders')} fill={SERIES.workOrders} radius={[4, 4, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </DashboardWidget>
      </div>
    </div>
  );
}
