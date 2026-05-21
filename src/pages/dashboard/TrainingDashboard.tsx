import { useAuthStore } from '../../store/authStore';
import TrainingComplianceStrip from '../../components/dashboard/training/TrainingComplianceStrip';
import ComplianceByMachineTable from '../../components/dashboard/training/ComplianceByMachineTable';
import OperatorTrainingTable from '../../components/dashboard/training/OperatorTrainingTable';
import TrainingActivityChart from '../../components/dashboard/training/TrainingActivityChart';
import DashboardSidePanel from '../../components/dashboard/shared/DashboardSidePanel';

export default function TrainingDashboard() {
  const companyId = useAuthStore((s) => s.userProfile?.companyId) ?? '';
  const firstName = useAuthStore((s) => s.userProfile?.fullName?.split(' ')[0]) ?? 'HR Officer';

  return (
    <div className="min-h-full bg-[#0A1628] text-[#F0F4F8]">
      <div className="px-4 py-4 sm:px-6 lg:px-8">
        <h1 className="text-xl font-bold text-[#F0F4F8] font-[Sora]">Training Dashboard</h1>
        <p className="text-sm text-[#8BA3BF] mt-0.5">
          Good {getGreeting()}, {firstName}
        </p>
      </div>

      <div className="px-4 pb-8 sm:px-6 lg:px-8 space-y-6">
        {/* KPI Strip */}
        <TrainingComplianceStrip companyId={companyId} />

        {/* Tables */}
        <ComplianceByMachineTable companyId={companyId} />
        <OperatorTrainingTable companyId={companyId} />

        {/* Chart */}
        <TrainingActivityChart companyId={companyId} />
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
