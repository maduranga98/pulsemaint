import { useState } from 'react';
import { ShieldAlert, Plus } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import KpiCard from '@/components/dashboard/shared/KpiCard';
import TodayTrainingsWidget from '@/components/dashboard/manager/TodayTrainingsWidget';
import TodayMyTrainingsWidget from '@/components/dashboard/manager/TodayMyTrainingsWidget';
import { useSafetyKpis } from '@/hooks/safety/useSafety';
import ReportSafetyCaseModal from '../components/ReportSafetyCaseModal';

export default function SafetyDashboard() {
  const profile = useAuthStore((s) => s.userProfile);
  const companyId = profile?.companyId ?? '';
  const firstName = profile?.fullName?.split(' ')[0] ?? 'Safety Officer';
  const { kpis, loading } = useSafetyKpis(companyId);
  const [reporting, setReporting] = useState(false);

  const cards = [
    { label: 'Total Safety Cases', value: kpis.totalCases, color: 'blue' as const },
    { label: 'Open Cases', value: kpis.openCases, color: (kpis.openCases > 0 ? 'amber' : 'green') as 'amber' | 'green' },
    { label: 'Near-Miss (30d)', value: kpis.nearMiss30d, color: (kpis.nearMiss30d > 0 ? 'amber' : 'green') as 'amber' | 'green' },
    { label: 'Safety Trainings Today', value: kpis.safetyTrainingsToday, color: 'cyan' as const },
    { label: 'Active Work Permits', value: kpis.activePermits, color: 'blue' as const },
    { label: 'Days Since Last Incident', value: kpis.daysSinceLastIncident ?? '—', color: 'green' as const },
  ];

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

        {/* Today's trainings — safety sessions company-wide, and this
            viewer's own not-yet-completed assignments due today. */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <TodayTrainingsWidget companyId={companyId} safetyOnly />
          <TodayMyTrainingsWidget />
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
