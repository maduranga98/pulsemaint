import { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';
import DashboardWidget from '../shared/DashboardWidget';
import EmptyState from '../shared/EmptyState';
import KpiCard from '../shared/KpiCard';
import { useSafetyCases, useSafetyKpis } from '@/hooks/safety/useSafety';
import { SAFETY_CASE_TYPES } from '@/types/safety';

const SEV_COLORS: Record<string, string> = { low: '#10B981', medium: '#EAB308', high: '#F59E0B', critical: '#EF4444' };
const AXIS = { stroke: '#8BA3BF', fontSize: 11 };

/**
 * Safety analytics snapshot — incident KPIs plus trend/type/severity charts.
 * Rendered inline on the manager (admin / plant_manager) dashboard so those
 * plant-wide roles see safety metrics without a separate Safety Analytics tab.
 */
interface SafetySnapshotWidgetProps {
  companyId: string;
  /** Hides the Total/Open/Near-Miss/Days-Since KPI cards, showing just the
   *  charts — used where those KPIs are already shown elsewhere on the page. */
  hideKpiCards?: boolean;
}

export default function SafetySnapshotWidget({ companyId, hideKpiCards = false }: SafetySnapshotWidgetProps) {
  const { cases, loading } = useSafetyCases(companyId);
  const { kpis } = useSafetyKpis(companyId);

  const byType = useMemo(() => {
    const m = new Map<string, number>();
    cases.forEach((c) => m.set(c.type, (m.get(c.type) ?? 0) + 1));
    return SAFETY_CASE_TYPES.map((t) => ({ name: t.label, count: m.get(t.value) ?? 0 })).filter((r) => r.count > 0);
  }, [cases]);

  const bySeverity = useMemo(() => {
    const m = new Map<string, number>();
    cases.forEach((c) => m.set(c.severity, (m.get(c.severity) ?? 0) + 1));
    return ['low', 'medium', 'high', 'critical']
      .map((s) => ({ name: s, value: m.get(s) ?? 0 }))
      .filter((r) => r.value > 0);
  }, [cases]);

  const cards = [
    { label: 'Total Safety Cases', value: kpis.totalCases, color: 'blue' as const },
    { label: 'Open Cases', value: kpis.openCases, color: (kpis.openCases > 0 ? 'amber' : 'green') as 'amber' | 'green' },
    { label: 'Near-Miss (30d)', value: kpis.nearMiss30d, color: 'cyan' as const },
    { label: 'Days Since Last Incident', value: kpis.daysSinceLastIncident ?? '—', color: 'green' as const },
  ];

  return (
    <div className="space-y-6">
      {!hideKpiCards && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {cards.map((c, i) => <KpiCard key={i} data={c} />)}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <DashboardWidget title="By Severity" loading={loading}>
            {bySeverity.length === 0 ? <EmptyState message="No data" /> : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={bySeverity} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                      {bySeverity.map((s) => <Cell key={s.name} fill={SEV_COLORS[s.name] ?? '#5B8DEF'} />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: '#0F1E35', border: '1px solid #1E3A5F', color: '#F0F4F8' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </DashboardWidget>
        </div>

        <div className="lg:col-span-7">
          <DashboardWidget title="By Case Type" loading={loading}>
            {byType.length === 0 ? <EmptyState message="No data" /> : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={byType}>
                    <CartesianGrid stroke="#1E3A5F" strokeDasharray="3 3" />
                    <XAxis dataKey="name" {...AXIS} />
                    <YAxis allowDecimals={false} {...AXIS} />
                    <Tooltip contentStyle={{ background: '#0F1E35', border: '1px solid #1E3A5F', color: '#F0F4F8' }} cursor={{ fill: '#1E3A5F33' }} />
                    <Bar dataKey="count" fill="#5B8DEF" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </DashboardWidget>
        </div>
      </div>
    </div>
  );
}
