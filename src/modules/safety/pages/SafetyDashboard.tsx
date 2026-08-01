import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ShieldAlert, Plus } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import KpiCard from '@/components/dashboard/shared/KpiCard';
import DashboardWidget from '@/components/dashboard/shared/DashboardWidget';
import EmptyState from '@/components/dashboard/shared/EmptyState';
import { useSafetyCases, useSafetyKpis, useWorkPermits } from '@/hooks/safety/useSafety';
import { SAFETY_CASE_TYPES, WORK_PERMIT_CATEGORIES, formatPermitDateTime } from '@/types/safety';
import ReportSafetyCaseModal from '../components/ReportSafetyCaseModal';

const SEV_HEX: Record<string, string> = {
  low: '#10B981',
  medium: '#EAB308',
  high: '#F59E0B',
  critical: '#EF4444',
};

const TYPE_LABEL = Object.fromEntries(SAFETY_CASE_TYPES.map((t) => [t.value, t.label]));
const CAT_LABEL = Object.fromEntries(WORK_PERMIT_CATEGORIES.map((c) => [c.value, c.label]));

const SEV_COLOR: Record<string, string> = {
  low: 'text-[#10B981]',
  medium: 'text-[#EAB308]',
  high: 'text-[#F59E0B]',
  critical: 'text-[#EF4444]',
};

const STATUS_COLOR: Record<string, string> = {
  open: 'bg-[#F59E0B]/15 text-[#F59E0B]',
  investigating: 'bg-[#1A56DB]/15 text-[#5B8DEF]',
  closed: 'bg-[#10B981]/15 text-[#10B981]',
};

export default function SafetyDashboard() {
  const profile = useAuthStore((s) => s.userProfile);
  const companyId = profile?.companyId ?? '';
  const firstName = profile?.fullName?.split(' ')[0] ?? 'Safety Officer';
  const { kpis, loading } = useSafetyKpis(companyId);
  const { cases } = useSafetyCases(companyId);
  const { permits } = useWorkPermits(companyId);
  const [reporting, setReporting] = useState(false);

  const cards = [
    { label: 'Total Safety Cases', value: kpis.totalCases, color: 'blue' as const },
    { label: 'Open Cases', value: kpis.openCases, color: (kpis.openCases > 0 ? 'amber' : 'green') as 'amber' | 'green' },
    { label: 'Near-Miss (30d)', value: kpis.nearMiss30d, color: (kpis.nearMiss30d > 0 ? 'amber' : 'green') as 'amber' | 'green' },
    { label: 'Safety Trainings Today', value: kpis.safetyTrainingsToday, color: 'cyan' as const },
    { label: 'Active Work Permits', value: kpis.activePermits, color: 'blue' as const },
    { label: 'Days Since Last Incident', value: kpis.daysSinceLastIncident ?? '—', color: 'green' as const },
  ];

  const recentCases = cases.slice(0, 8);
  const activePermits = permits.filter((p) => p.status === 'active').slice(0, 6);

  const severityData = useMemo(() => {
    const counts = new Map<string, number>();
    cases.forEach((c) => counts.set(c.severity, (counts.get(c.severity) ?? 0) + 1));
    return Array.from(counts.entries()).map(([name, value]) => ({ name, value }));
  }, [cases]);

  const monthlyTrend = useMemo(() => {
    const now = new Date();
    const months = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      return { key: `${d.getFullYear()}-${d.getMonth()}`, label: d.toLocaleString('en', { month: 'short' }), count: 0 };
    });
    const byKey = new Map(months.map((m) => [m.key, m]));
    cases.forEach((c) => {
      const d = c.reportedAt?.toDate?.();
      if (!d) return;
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      const bucket = byKey.get(key);
      if (bucket) bucket.count += 1;
    });
    return months;
  }, [cases]);

  return (
    <div className="min-h-full bg-[#0A1628] text-[#F0F4F8]">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
        <div>
          <h1 className="flex items-center gap-2 font-[Sora] text-xl font-bold text-[#F0F4F8]">
            <ShieldAlert className="h-5 w-5 text-[#F59E0B]" /> Safety Dashboard
          </h1>
          <p className="mt-0.5 text-sm text-[#8BA3BF]">Good {greeting()}, {firstName}</p>
        </div>
        <button
          type="button"
          onClick={() => setReporting(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-[#1A56DB] px-4 py-2 text-sm font-bold text-white"
        >
          <Plus className="h-4 w-4" /> Report Safety Case
        </button>
      </div>

      <div className="space-y-6 px-4 pb-10 sm:px-6 lg:px-8">
        {/* KPI strip */}
        {loading ? (
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-24 animate-pulse rounded-xl border border-[#1E3A5F] bg-[#0F1E35]" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
            {cards.map((c, i) => <KpiCard key={i} data={c} />)}
          </div>
        )}

        {/* Charts */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <DashboardWidget title="Cases by Severity">
            {severityData.length === 0 ? (
              <EmptyState message="No safety cases logged yet" />
            ) : (
              <div className="h-56">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={severityData} dataKey="value" nameKey="name" innerRadius={40} outerRadius={75} paddingAngle={2}>
                      {severityData.map((d) => <Cell key={d.name} fill={SEV_HEX[d.name] ?? '#5B8DEF'} />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: '#0F1E35', border: '1px solid #1E3A5F', color: '#F0F4F8' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </DashboardWidget>
          <DashboardWidget title="Cases Reported — Last 6 Months">
            <div className="h-56">
              <ResponsiveContainer>
                <BarChart data={monthlyTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1E3A5F" />
                  <XAxis dataKey="label" stroke="#8BA3BF" fontSize={11} />
                  <YAxis allowDecimals={false} stroke="#8BA3BF" fontSize={11} />
                  <Tooltip contentStyle={{ background: '#0F1E35', border: '1px solid #1E3A5F', color: '#F0F4F8' }} />
                  <Bar dataKey="count" fill="#1A56DB" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </DashboardWidget>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Recent safety cases */}
          <div className="lg:col-span-8">
            <DashboardWidget title="Recent Safety Cases">
              {recentCases.length === 0 ? (
                <EmptyState message="No safety cases logged yet" />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[#1E3A5F] text-left text-xs text-[#8BA3BF]">
                        <th className="py-2 pr-3">Case</th>
                        <th className="py-2 pr-3">Type</th>
                        <th className="py-2 pr-3">Severity</th>
                        <th className="py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentCases.map((c) => (
                        <tr key={c.id} className="border-b border-[#1E3A5F]/50">
                          <td className="py-2 pr-3">
                            <div className="font-medium text-[#F0F4F8]">{c.title}</div>
                            {c.location && <div className="text-xs text-[#8BA3BF]">{c.location}</div>}
                          </td>
                          <td className="py-2 pr-3 text-[#8BA3BF]">{TYPE_LABEL[c.type] ?? c.type}</td>
                          <td className={`py-2 pr-3 font-semibold ${SEV_COLOR[c.severity] ?? ''}`}>{c.severity}</td>
                          <td className="py-2">
                            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[c.status] ?? ''}`}>{c.status}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </DashboardWidget>
          </div>

          {/* Active permits */}
          <div className="lg:col-span-4">
            <DashboardWidget title="Active Work Permits">
              {activePermits.length === 0 ? (
                <EmptyState message="No active permits" />
              ) : (
                <div className="space-y-2">
                  {activePermits.map((p) => (
                    <Link
                      key={p.id}
                      to="/app/safety/permits"
                      className="block rounded-lg border border-[#1E3A5F] bg-[#0A1628] px-3 py-2 hover:border-[#2E5A8F]"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-[#F0F4F8]">{p.title}</span>
                        <span className="font-mono text-[10px] text-[#8BA3BF]">{p.permitNumber}</span>
                      </div>
                      <div className="text-xs text-[#8BA3BF]">{CAT_LABEL[p.category] ?? p.category} · until {formatPermitDateTime(p.validTo)}</div>
                    </Link>
                  ))}
                </div>
              )}
            </DashboardWidget>
          </div>
        </div>
      </div>

      {reporting && <ReportSafetyCaseModal onClose={() => setReporting(false)} />}
    </div>
  );
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 18) return 'afternoon';
  return 'evening';
}
