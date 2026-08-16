import { useAuthStore } from '../../store/authStore';
import TeamPerformanceAnalyticsWidget from '../../components/dashboard/manager/TeamPerformanceAnalyticsWidget';
import TopPerformersWidget from '../../components/dashboard/manager/TopPerformersWidget';
import TrainingActivityChart from '../../components/dashboard/training/TrainingActivityChart';
import OperatorTrainingTable from '../../components/dashboard/training/OperatorTrainingTable';
import StaffByRoleChart from '../../components/dashboard/training/StaffByRoleChart';
import OngoingTrainingsWidget from '../../components/dashboard/training/OngoingTrainingsWidget';

// HR officer's Analytics tab — Team Performance, Training Activity, Training
// Status, and Staff Headcount by Role used to live on the HR dashboard
// itself; they now live here instead, alongside a live view of every
// training currently in progress (who, their role, and how far along).
export default function HrAnalyticsPage() {
  const companyId = useAuthStore((s) => s.userProfile?.companyId) ?? '';

  return (
    <div className="min-h-full bg-[#0A1628] text-[#F0F4F8]">
      <div className="px-4 py-4 sm:px-6 lg:px-8">
        <h1 className="text-xl font-bold text-[#F0F4F8] font-[Sora]">HR Analytics</h1>
        <p className="text-sm text-[#8BA3BF] mt-0.5">
          Team performance, training activity, and staff training progress.
        </p>
      </div>

      <div className="px-4 pb-8 sm:px-6 lg:px-8 space-y-6">
        <OngoingTrainingsWidget companyId={companyId} />

        <TopPerformersWidget companyId={companyId} />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <TeamPerformanceAnalyticsWidget companyId={companyId} />
          <TrainingActivityChart companyId={companyId} />
        </div>

        <OperatorTrainingTable companyId={companyId} />

        <StaffByRoleChart companyId={companyId} />
      </div>
    </div>
  );
}
