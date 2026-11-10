import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Tooltip } from 'recharts';
import DashboardWidget from '../shared/DashboardWidget';
import EmptyState from '../shared/EmptyState';
import { useTopProblemMachines } from '../../../hooks/dashboard/useTopProblemMachines';

interface Props { companyId: string; month: string | string[] }

/** The six busiest machines as a radar: each spoke is one machine's work orders as a share of the busiest one. */
export default function MachineLoadRadar({ companyId, month }: Props) {
  const { t } = useTranslation();
  const { data, loading } = useTopProblemMachines(companyId, month);

  const { rows, average } = useMemo(() => {
    const top = (data?.topProblemMachines ?? []).slice(0, 6);
    const max = Math.max(1, ...top.map((m) => m.woCount));
    const rows = top.map((m) => ({ name: m.machineName.length > 14 ? `${m.machineName.slice(0, 13)}…` : m.machineName, full: m.machineName, value: Math.round((m.woCount / max) * 100), wos: m.woCount }));
    return { rows, average: rows.length ? Math.round(rows.reduce((s, r) => s + r.value, 0) / rows.length) : 0 };
  }, [data]);

  return (
    <DashboardWidget title={t('common.analytics.charts.radarTitle', { defaultValue: 'Machine load' })} loading={loading}>
      {rows.length < 3 ? (
        <EmptyState message={t('common.widgets.breakdownByTypeChart.empty')} />
      ) : (
        <div className="radar-wrap">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={rows} outerRadius="72%">
                <PolarGrid />
                <PolarAngleAxis dataKey="name" tick={{ fontSize: 11 }} />
                <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                <Tooltip formatter={(v, _n, item) => [`${(item?.payload as { wos?: number })?.wos ?? v} WO`, (item?.payload as { full?: string })?.full ?? '']} />
                <Radar dataKey="value" stroke="#6D5DF6" strokeWidth={2} fill="#6D5DF6" fillOpacity={0.5} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
          <span className="radar-center">{average}</span>
        </div>
      )}
    </DashboardWidget>
  );
}
