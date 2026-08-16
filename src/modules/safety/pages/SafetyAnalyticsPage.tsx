import { useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';
import { ShieldAlert } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import DashboardWidget from '@/components/dashboard/shared/DashboardWidget';
import EmptyState from '@/components/dashboard/shared/EmptyState';
import { useSafetyCases } from '@/hooks/safety/useSafety';
import { SAFETY_CASE_TYPES } from '@/types/safety';

const SEV_COLORS: Record<string, string> = { low: '#10B981', medium: '#EAB308', high: '#F59E0B', critical: '#EF4444' };
const AXIS = { stroke: '#8BA3BF', fontSize: 11 };
const TOOLTIP_STYLE = { background: '#0F1E35', border: '1px solid #1E3A5F', color: '#F0F4F8' };

type TabId = 'severity' | 'type' | 'technicians' | 'machines';

const TABS: { id: TabId; label: string }[] = [
  { id: 'severity', label: 'Cases by Severity' },
  { id: 'type', label: 'Cases by Type' },
  { id: 'technicians', label: 'Top 5 Technicians' },
  { id: 'machines', label: 'Top 5 Machines' },
];

export default function SafetyAnalyticsPage() {
  const companyId = useAuthStore((s) => s.userProfile?.companyId) ?? '';
  const { cases, loading } = useSafetyCases(companyId);
  const [activeTab, setActiveTab] = useState<TabId>('severity');

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

  // Cases whose subject is specifically a technician — the case is
  // reported "about" that person, which is the direct technician
  // involvement a safety case captures (there's no separate WO/machine ->
  // assigned-technician join available on the case record itself).
  const topTechnicians = useMemo(() => {
    const m = new Map<string, { name: string; count: number }>();
    cases
      .filter((c) => c.subjectType === 'technician' && c.subjectId)
      .forEach((c) => {
        const key = c.subjectId as string;
        const existing = m.get(key);
        if (existing) existing.count += 1;
        else m.set(key, { name: c.subjectName ?? 'Unknown technician', count: 1 });
      });
    return Array.from(m.values()).sort((a, b) => b.count - a.count).slice(0, 5);
  }, [cases]);

  const topMachines = useMemo(() => {
    const m = new Map<string, { name: string; count: number }>();
    cases
      .filter((c) => c.machineId)
      .forEach((c) => {
        const key = c.machineId as string;
        const existing = m.get(key);
        if (existing) existing.count += 1;
        else m.set(key, { name: c.machineName ?? 'Unknown machine', count: 1 });
      });
    return Array.from(m.values()).sort((a, b) => b.count - a.count).slice(0, 5);
  }, [cases]);

  return (
    <div className="min-h-full bg-[#0A1628] p-4 text-[#F0F4F8] sm:p-6 lg:p-8">
      <h1 className="mb-1 flex items-center gap-2 font-[Sora] text-xl font-bold">
        <ShieldAlert className="h-5 w-5 text-[#F59E0B]" /> Safety Analytics
      </h1>
      <p className="mb-5 text-sm text-[#8BA3BF]">Incident trends, types, severity, and involvement across the factory.</p>

      <div className="mb-6 flex flex-wrap gap-1 border-b border-[#1E3A5F]">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap ${
              activeTab === tab.id
                ? 'border-[#1A56DB] text-[#F0F4F8]'
                : 'border-transparent text-[#8BA3BF] hover:text-[#F0F4F8]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'severity' && (
        <DashboardWidget title="Cases by Severity" loading={loading}>
          {bySeverity.length === 0 ? <EmptyState message="No data" /> : (
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={bySeverity} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={110} label>
                    {bySeverity.map((s) => <Cell key={s.name} fill={SEV_COLORS[s.name] ?? '#5B8DEF'} />)}
                  </Pie>
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </DashboardWidget>
      )}

      {activeTab === 'type' && (
        <DashboardWidget title="Cases by Type" loading={loading}>
          {byType.length === 0 ? <EmptyState message="No data" /> : (
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byType}>
                  <CartesianGrid stroke="#1E3A5F" strokeDasharray="3 3" />
                  <XAxis dataKey="name" {...AXIS} />
                  <YAxis allowDecimals={false} {...AXIS} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: '#1E3A5F33' }} />
                  <Bar dataKey="count" fill="#5B8DEF" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </DashboardWidget>
      )}

      {activeTab === 'technicians' && (
        <DashboardWidget title="Top 5 Technicians by Safety Cases" loading={loading}>
          {topTechnicians.length === 0 ? <EmptyState message="No technician-linked cases yet" /> : (
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topTechnicians} layout="vertical" margin={{ left: 0, right: 24 }}>
                  <CartesianGrid stroke="#1E3A5F" strokeDasharray="3 3" />
                  <XAxis type="number" allowDecimals={false} {...AXIS} />
                  <YAxis dataKey="name" type="category" width={140} {...AXIS} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: '#1E3A5F33' }} />
                  <Bar dataKey="count" name="Safety cases" fill="#F59E0B" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </DashboardWidget>
      )}

      {activeTab === 'machines' && (
        <DashboardWidget title="Top 5 Machines by Safety Cases" loading={loading}>
          {topMachines.length === 0 ? <EmptyState message="No machine-linked cases yet" /> : (
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topMachines} layout="vertical" margin={{ left: 0, right: 24 }}>
                  <CartesianGrid stroke="#1E3A5F" strokeDasharray="3 3" />
                  <XAxis type="number" allowDecimals={false} {...AXIS} />
                  <YAxis dataKey="name" type="category" width={140} {...AXIS} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: '#1E3A5F33' }} />
                  <Bar dataKey="count" name="Safety cases" fill="#EF4444" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </DashboardWidget>
      )}
    </div>
  );
}
