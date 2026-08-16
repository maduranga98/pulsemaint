import { useMemo } from 'react';
import { useAuthStore } from '../../store/authStore';
import HrKpiStrip from '../../components/dashboard/training/HrKpiStrip';
import TodayShiftsByDepartment from '../../components/dashboard/manager/TodayShiftsByDepartment';
import OngoingEvaluationsAuditsWidget from '../../components/dashboard/training/OngoingEvaluationsAuditsWidget';
import ContractorScoreboard from '../../components/dashboard/manager/ContractorScoreboard';
import ProgrammeSignOffQueueWidget from '../../components/dashboard/training/ProgrammeSignOffQueueWidget';
import MyTrainingsWidget from '../../components/dashboard/technician/MyTrainingsWidget';
import DashboardSidePanel from '../../components/dashboard/shared/DashboardSidePanel';

export default function TrainingDashboard() {
  const companyId = useAuthStore((s) => s.userProfile?.companyId) ?? '';
  const firstName = useAuthStore((s) => s.userProfile?.fullName?.split(' ')[0]) ?? 'HR Officer';

  const currentMonth = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }, []);

  return (
    <div className="min-h-full bg-[#0A1628] text-[#F0F4F8]">
      <div className="px-4 py-4 sm:px-6 lg:px-8">
        <h1 className="text-xl font-bold text-[#F0F4F8] font-[Sora]">HR Dashboard</h1>
        <p className="text-sm text-[#8BA3BF] mt-0.5">
          Good {getGreeting()}, {firstName}
        </p>
      </div>

      <div className="px-4 pb-8 sm:px-6 lg:px-8 space-y-6">
        {/* KPI Strip — HR-focused headline numbers (attendance, in-flight
            training/evaluations, headcount) */}
        <HrKpiStrip companyId={companyId} />

        {/* Today's shifts grouped by department (replaces Compliance by Machine) */}
        <TodayShiftsByDepartment companyId={companyId} />

        {/* Trainees ready for their programme completion sign-off */}
        <ProgrammeSignOffQueueWidget companyId={companyId} />

        {/* Team Performance, Training Activity, Training Status, and Staff
            Headcount by Role now live on the Analytics tab (Insights >
            Analytics) instead of here — see HrAnalyticsPage. */}
        <OngoingEvaluationsAuditsWidget companyId={companyId} />

        {/* Contractor Scoreboard / suppliers / top performers (HR-003) */}
        <ContractorScoreboard companyId={companyId} month={currentMonth} />

        {/* HR officer's own outstanding trainings — replaces the old nav tab */}
        <MyTrainingsWidget />
      </div>

      <DashboardSidePanel />
    </div>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 18) return 'afternoon';
  return 'evening';
}
