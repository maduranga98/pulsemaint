import { useMemo } from 'react';
import { useAuthStore } from '../../store/authStore';
import TrainingComplianceStrip from '../../components/dashboard/training/TrainingComplianceStrip';
import ComplianceByMachineTable from '../../components/dashboard/training/ComplianceByMachineTable';
import OperatorTrainingTable from '../../components/dashboard/training/OperatorTrainingTable';
import TrainingActivityChart from '../../components/dashboard/training/TrainingActivityChart';
import StaffByRoleChart from '../../components/dashboard/training/StaffByRoleChart';
import HrActivityByRoleChart from '../../components/dashboard/training/HrActivityByRoleChart';
import TeamPerformanceAnalyticsWidget from '../../components/dashboard/manager/TeamPerformanceAnalyticsWidget';
import ContractorScoreboard from '../../components/dashboard/manager/ContractorScoreboard';
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
        {/* KPI Strip */}
        <TrainingComplianceStrip companyId={companyId} />

        {/* Staff headcount by role (HR-001) */}
        <StaffByRoleChart companyId={companyId} />

        {/* Tables */}
        <ComplianceByMachineTable companyId={companyId} />
        <OperatorTrainingTable companyId={companyId} />

        {/* Graphical HR metrics: Team Performance, Trainings, Evaluations, Audit, Triage (HR-002) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <TeamPerformanceAnalyticsWidget companyId={companyId} />
          <TrainingActivityChart companyId={companyId} />
        </div>
        <HrActivityByRoleChart companyId={companyId} />

        {/* Contractor Scoreboard / suppliers / top performers (HR-003) */}
        <ContractorScoreboard companyId={companyId} month={currentMonth} />
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
