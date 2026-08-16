import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert, Plus } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import KpiCard from '@/components/dashboard/shared/KpiCard';
import DashboardWidget from '@/components/dashboard/shared/DashboardWidget';
import EmptyState from '@/components/dashboard/shared/EmptyState';
import { useSafetyKpis, useWorkPermits } from '@/hooks/safety/useSafety';
import { WORK_PERMIT_CATEGORIES, formatPermitDateTime } from '@/types/safety';
import ReportSafetyCaseModal from '../components/ReportSafetyCaseModal';

const CAT_LABEL = Object.fromEntries(WORK_PERMIT_CATEGORIES.map((c) => [c.value, c.label]));

export default function SafetyDashboard() {
  const profile = useAuthStore((s) => s.userProfile);
  const companyId = profile?.companyId ?? '';
  const firstName = profile?.fullName?.split(' ')[0] ?? 'Safety Officer';
  const { kpis, loading } = useSafetyKpis(companyId);
  const { permits, loading: permitsLoading } = useWorkPermits(companyId);
  const [reporting, setReporting] = useState(false);

  const cards = [
    { label: 'Total Safety Cases', value: kpis.totalCases, color: 'blue' as const },
    { label: 'Open Cases', value: kpis.openCases, color: (kpis.openCases > 0 ? 'amber' : 'green') as 'amber' | 'green' },
    { label: 'Near-Miss (30d)', value: kpis.nearMiss30d, color: (kpis.nearMiss30d > 0 ? 'amber' : 'green') as 'amber' | 'green' },
    { label: 'Safety Trainings Today', value: kpis.safetyTrainingsToday, color: 'cyan' as const },
    { label: 'Active Work Permits', value: kpis.activePermits, color: 'blue' as const },
    { label: 'Days Since Last Incident', value: kpis.daysSinceLastIncident ?? '—', color: 'green' as const },
  ];

  const activePermits = permits.filter((p) => p.status === 'active');

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
        {/* KPI strip — live counts */}
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

        {/* Active work permits — bottom of the page, live list */}
        <DashboardWidget title="Active Work Permits" loading={permitsLoading}>
          {activePermits.length === 0 ? (
            <EmptyState message="No active permits" />
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
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
