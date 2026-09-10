import { useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';
import { ShieldAlert, Ban } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/store/authStore';
import DashboardWidget from '@/components/dashboard/shared/DashboardWidget';
import EmptyState from '@/components/dashboard/shared/EmptyState';
import KpiCard from '@/components/dashboard/shared/KpiCard';
import { useSafetyCases, useSafetyBlacklist } from '@/hooks/safety/useSafety';
import { SAFETY_CASE_TYPES } from '@/types/safety';
import { BLACKLIST_THRESHOLD, type BlacklistEntityType } from '@/lib/safety/blacklist';

const SEV_COLORS: Record<string, string> = { low: '#10B981', medium: '#EAB308', high: '#F59E0B', critical: '#EF4444' };
const AXIS = { stroke: '#8BA3BF', fontSize: 11 };
const TOOLTIP_STYLE = { background: '#0F1E35', border: '1px solid #1E3A5F', color: '#F0F4F8' };

type TabId = 'severity' | 'type' | 'technicians' | 'machines' | 'blacklist';

export default function SafetyAnalyticsPage() {
  const { t } = useTranslation();
  const companyId = useAuthStore((s) => s.userProfile?.companyId) ?? '';

  const ENTITY_LABEL: Record<BlacklistEntityType, string> = {
    technician: t('common.analytics.safetyPage.entityTypes.technician'),
    contractor: t('common.analytics.safetyPage.entityTypes.contractor'),
    operator: t('common.analytics.safetyPage.entityTypes.operator'),
    machine: t('common.analytics.safetyPage.entityTypes.machine'),
  };

  const TABS: { id: TabId; label: string }[] = [
    { id: 'severity', label: t('common.analytics.safetyPage.tabs.severity') },
    { id: 'type', label: t('common.analytics.safetyPage.tabs.type') },
    { id: 'technicians', label: t('common.analytics.safetyPage.tabs.technicians') },
    { id: 'machines', label: t('common.analytics.safetyPage.tabs.machines') },
    { id: 'blacklist', label: t('common.analytics.safetyPage.tabs.blacklist') },
  ];

  const DURATION_OPTIONS = [
    { label: t('common.analytics.durationOptions.days', { count: 7 }), days: 7 },
    { label: t('common.analytics.durationOptions.days', { count: 30 }), days: 30 },
    { label: t('common.analytics.durationOptions.days', { count: 90 }), days: 90 },
  ] as const;
  const { cases: allCases, loading } = useSafetyCases(companyId);
  const { entries: blacklistEntries, loading: blacklistLoading } = useSafetyBlacklist(companyId);
  const blacklisted = useMemo(() => blacklistEntries.filter((e) => e.isBlacklisted), [blacklistEntries]);
  const [activeTab, setActiveTab] = useState<TabId>('severity');
  const [days, setDays] = useState<number>(30);

  const cases = useMemo(() => {
    const since = Date.now() - days * 24 * 60 * 60 * 1000;
    return allCases.filter((c) => {
      const reportedAt = c.reportedAt?.toDate?.();
      return reportedAt ? reportedAt.getTime() >= since : false;
    });
  }, [allCases, days]);

  const openCases = useMemo(() => cases.filter((c) => c.status !== 'closed'), [cases]);
  const openByStatus = useMemo(() => {
    const m = new Map<string, number>();
    openCases.forEach((c) => m.set(c.status, (m.get(c.status) ?? 0) + 1));
    return m;
  }, [openCases]);

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
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="mb-1 flex items-center gap-2 text-xl font-bold">
            <ShieldAlert className="h-5 w-5 text-[#F59E0B]" /> {t('common.analytics.safetyPage.title')}
          </h1>
          <p className="text-sm text-[#8BA3BF]">{t('common.analytics.safetyPage.subtitle')}</p>
        </div>
        <div className="inline-flex rounded-lg border border-[#1E3A5F] bg-[#0F1E35] p-1 text-xs">
          {DURATION_OPTIONS.map((opt) => (
            <button
              key={opt.days}
              type="button"
              onClick={() => setDays(opt.days)}
              className={`px-3 py-1.5 rounded-md font-medium transition ${
                days === opt.days ? 'bg-[#1A56DB] text-white' : 'text-[#8BA3BF] hover:text-[#F0F4F8]'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Not-closed cases, with current status breakdown — a live count, not a tab. */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-3">
        <KpiCard data={{ label: t('common.analytics.safetyPage.kpis.notClosed'), value: openCases.length, color: (openCases.length > 0 ? 'amber' : 'green') }} />
        <KpiCard data={{ label: t('common.analytics.safetyPage.kpis.open'), value: openByStatus.get('open') ?? 0, color: 'amber' }} />
        <KpiCard data={{ label: t('common.analytics.safetyPage.kpis.investigating'), value: openByStatus.get('investigating') ?? 0, color: 'blue' }} />
      </div>

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
        <DashboardWidget title={t('common.analytics.safetyPage.tabs.severity')} loading={loading}>
          {bySeverity.length === 0 ? <EmptyState message={t('common.widgets.common.noData')} /> : (
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
        <DashboardWidget title={t('common.analytics.safetyPage.tabs.type')} loading={loading}>
          {byType.length === 0 ? <EmptyState message={t('common.widgets.common.noData')} /> : (
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
        <DashboardWidget title={t('common.analytics.safetyPage.charts.topTechnicians')} loading={loading}>
          {topTechnicians.length === 0 ? <EmptyState message={t('common.analytics.safetyPage.empty.noTechnicianCases')} /> : (
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topTechnicians} layout="vertical" margin={{ left: 0, right: 24 }}>
                  <CartesianGrid stroke="#1E3A5F" strokeDasharray="3 3" />
                  <XAxis type="number" allowDecimals={false} {...AXIS} />
                  <YAxis dataKey="name" type="category" width={140} {...AXIS} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: '#1E3A5F33' }} />
                  <Bar dataKey="count" name={t('common.analytics.safetyPage.charts.safetyCasesSeriesName')} fill="#F59E0B" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </DashboardWidget>
      )}

      {activeTab === 'machines' && (
        <DashboardWidget title={t('common.analytics.safetyPage.charts.topMachines')} loading={loading}>
          {topMachines.length === 0 ? <EmptyState message={t('common.analytics.safetyPage.empty.noMachineCases')} /> : (
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topMachines} layout="vertical" margin={{ left: 0, right: 24 }}>
                  <CartesianGrid stroke="#1E3A5F" strokeDasharray="3 3" />
                  <XAxis type="number" allowDecimals={false} {...AXIS} />
                  <YAxis dataKey="name" type="category" width={140} {...AXIS} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: '#1E3A5F33' }} />
                  <Bar dataKey="count" name={t('common.analytics.safetyPage.charts.safetyCasesSeriesName')} fill="#EF4444" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </DashboardWidget>
      )}

      {activeTab === 'blacklist' && (
        <DashboardWidget
          title={t('common.analytics.safetyPage.charts.blacklisted', { threshold: BLACKLIST_THRESHOLD })}
          loading={blacklistLoading}
        >
          {blacklisted.length === 0 ? <EmptyState message={t('common.analytics.safetyPage.empty.noOneBlacklisted')} /> : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm">
                <thead>
                  <tr className="border-b border-[#1E3A5F] text-left text-xs uppercase text-[#8BA3BF]">
                    <th className="py-2 pr-3 font-medium">{t('common.analytics.safetyPage.table.name')}</th>
                    <th className="py-2 pr-3 font-medium">{t('common.analytics.safetyPage.table.type')}</th>
                    <th className="py-2 pr-3 font-medium">{t('common.analytics.safetyPage.table.points')}</th>
                    <th className="py-2 pr-3 font-medium">{t('common.analytics.safetyPage.table.cases')}</th>
                  </tr>
                </thead>
                <tbody>
                  {blacklisted.map((e) => (
                    <tr key={`${e.entityType}:${e.entityId}`} className="border-b border-[#1E3A5F]/50 last:border-0">
                      <td className="py-2.5 pr-3 font-medium text-[#F0F4F8]">{e.entityName}</td>
                      <td className="py-2.5 pr-3 text-[#8BA3BF]">{ENTITY_LABEL[e.entityType]}</td>
                      <td className="py-2.5 pr-3 font-semibold text-[#EF4444]">
                        <span className="inline-flex items-center gap-1"><Ban className="h-3.5 w-3.5" /> {e.points}</span>
                      </td>
                      <td className="py-2.5 pr-3 text-[#8BA3BF]">{e.caseCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </DashboardWidget>
      )}
    </div>
  );
}
