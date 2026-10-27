import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../store/authStore';
import HrKpiStrip from '../../components/dashboard/training/HrKpiStrip';
import TodayShiftsByDepartment from '../../components/dashboard/manager/TodayShiftsByDepartment';
import OngoingEvaluationsAuditsWidget from '../../components/dashboard/training/OngoingEvaluationsAuditsWidget';
import ContractorScoreboard from '../../components/dashboard/manager/ContractorScoreboard';
import ProgrammeSignOffQueueWidget from '../../components/dashboard/training/ProgrammeSignOffQueueWidget';
import MyTrainingsWidget from '../../components/dashboard/technician/MyTrainingsWidget';
import DashboardSidePanel from '../../components/dashboard/shared/DashboardSidePanel';
import { useModuleEnabled } from '../../hooks/useModuleEnabled';
import { monthsForDashboardRange } from '../../utils/analytics/dashboardRange';

export default function TrainingDashboard() {
  const { t } = useTranslation();
  const auditOn = useModuleEnabled('audit');
  const contractorsOn = useModuleEnabled('contractors');
  const evalOn = useModuleEnabled('evaluations');
  const shiftOn = useModuleEnabled('shift');
  const trainingOn = useModuleEnabled('training');
  const companyId = useAuthStore((s) => s.userProfile?.companyId) ?? '';
  const firstName = useAuthStore((s) => s.userProfile?.fullName?.split(' ')[0]) ?? 'HR Officer';

  // Contractor jobs of the last six months — a single calendar month leaves
  // the scoreboard empty at the start of a month or in a quiet one.
  const scoreboardMonths = useMemo(() => monthsForDashboardRange('6m'), []);

  return (
    <div className="min-h-full bg-[#0A1628] text-[#F0F4F8]">
      <div className="pb-4">
        <h1 className="text-xl font-bold text-[#F0F4F8]">{t('common.dashboard.hrTitle')}</h1>
        <p className="text-sm text-[#8BA3BF] mt-0.5">
          {t('common.dashboard.greeting.text', { time: t(`common.dashboard.greeting.${getGreeting()}`), name: firstName })}
        </p>
      </div>

      <div className="pb-8 space-y-6">
        {/* KPI Strip — HR-focused headline numbers (attendance, in-flight
            training/evaluations, headcount) */}
        <HrKpiStrip companyId={companyId} />

        {/* Today's shifts grouped by department (replaces Compliance by Machine) */}
        {shiftOn && <TodayShiftsByDepartment companyId={companyId} />}

        {/* Trainees ready for their programme completion sign-off */}
        {trainingOn && <ProgrammeSignOffQueueWidget companyId={companyId} />}

        {/* Team Performance, Training Activity, Training Status, and Staff
            Headcount by Role now live on the Analytics tab (Insights >
            Analytics) instead of here — see HrAnalyticsPage. */}
        {(evalOn || auditOn) && <OngoingEvaluationsAuditsWidget companyId={companyId} />}

        {/* Contractor Scoreboard / suppliers / top performers (HR-003) */}
        {contractorsOn && <ContractorScoreboard companyId={companyId} month={scoreboardMonths} />}

        {/* HR officer's own outstanding trainings — replaces the old nav tab */}
        {trainingOn && <MyTrainingsWidget readOnly />}
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
