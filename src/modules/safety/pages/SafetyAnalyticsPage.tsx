import { useMemo } from 'react';
import { ShieldAlert } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line,
} from 'recharts';
import { useAuthStore } from '@/store/authStore';
import DashboardWidget from '@/components/dashboard/shared/DashboardWidget';
import EmptyState from '@/components/dashboard/shared/EmptyState';
import KpiCard from '@/components/dashboard/shared/KpiCard';
import { useSafetyCases, useSafetyKpis } from '@/hooks/safety/useSafety';
import { SAFETY_CASE_TYPES } from '@/types/safety';

const SEV_COLORS: Record<string, string> = { low: '#10B981', medium: '#EAB308', high: '#F59E0B', critical: '#EF4444' };
const AXIS = { stroke: '#8BA3BF', fontSize: 11 };

function millis(ts: { seconds: number } | null | undefined): number {
  return ts?.seconds ? ts.seconds * 1000 : 0;
}

export default function SafetyAnalyticsPage() {
  const companyId = useAuthStore((s) => s.userProfile?.companyId) ?? '';
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

  const byMonth = useMemo(() => {
    const m = new Map<string, number>();
    cases.forEach((c) => {
      const t = millis(c.reportedAt);
      if (!t) return;
      const key = new Date(t).toISOString().slice(0, 7);
      m.set(key, (m.get(key) ?? 0) + 1);
    });
    return Array.from(m.entries()).sort(([a], [b]) => a.localeCompare(b)).slice(-12).map(([month, count]) => ({ month, count }));
  }, [cases]);

  const cards = [
    { label: 'Total Safety Cases', value: kpis.totalCases, color: 'blue' as const },
    { label: 'Open Cases', value: kpis.openCases, color: (kpis.openCases > 0 ? 'amber' : 'green') as 'amber' | 'green' },
    { label: 'Near-Miss (30d)', value: kpis.nearMiss30d, color: 'cyan' as const },
    { label: 'Days Since Last Incident', value: kpis.daysSinceLastIncident ?? '—', color: 'green' as const },
  ];

  return (
    <div className="min-h-full bg-[#0A1628] p-4 text-[#F0F4F8] sm:p-6 lg:p-8">
      <h1 className="mb-1 flex items-center gap-2 font-[Sora] text-xl font-bold">
        <ShieldAlert className="h-5 w-5 text-[#F59E0B]" /> Safety Analytics
      </h1>
      <p className="mb-5 text-sm text-[#8BA3BF]">Incident trends, types, and severity across the factory.</p>

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cards.map((c, i) => <KpiCard key={i} data={c} />)}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <DashboardWidget title="Safety Cases by Month" loading={loading}>
            {byMonth.length === 0 ? <EmptyState message="No case history yet" /> : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={byMonth}>
                    <CartesianGrid stroke="#1E3A5F" strokeDasharray="3 3" />
                    <XAxis dataKey="month" {...AXIS} />
                    <YAxis allowDecimals={false} {...AXIS} />
                    <Tooltip contentStyle={{ background: '#0F1E35', border: '1px solid #1E3A5F', color: '#F0F4F8' }} />
                    <Line type="monotone" dataKey="count" stroke="#5B8DEF" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </DashboardWidget>
        </div>

        <div className="lg:col-span-4">
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

        <div className="lg:col-span-12">
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
