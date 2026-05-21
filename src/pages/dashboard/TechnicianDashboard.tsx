import { useAuthStore } from '../../store/authStore';
import { useMyJobQueue } from '../../hooks/dashboard/useMyJobQueue';
import ActiveJobCard from '../../components/dashboard/technician/ActiveJobCard';
import JobQueueList from '../../components/dashboard/technician/JobQueueList';
import TodaysPmList from '../../components/dashboard/technician/TodaysPmList';
import PersonalKpiCards from '../../components/dashboard/technician/PersonalKpiCards';
import DashboardSidePanel from '../../components/dashboard/shared/DashboardSidePanel';

export default function TechnicianDashboard() {
  const userProfile = useAuthStore((s) => s.userProfile);
  const technicianId = userProfile?.id ?? '';
  const siteId = userProfile?.siteIds?.[0] ?? '';
  const firstName = userProfile?.fullName?.split(' ')[0] ?? 'Technician';

  const { workOrders } = useMyJobQueue(technicianId, siteId);

  // Find active job (IN_PROGRESS)
  const activeJob = workOrders.find((wo) => wo.status === 'IN_PROGRESS') ?? null;

  return (
    <div className="min-h-full bg-[#0A1628] text-[#F0F4F8]">
      <div className="px-4 py-4 sm:px-6 lg:px-8">
        <h1 className="text-xl font-bold text-[#F0F4F8] font-[Sora]">Technician Dashboard</h1>
        <p className="text-sm text-[#8BA3BF] mt-0.5">
          Good {getGreeting()}, {firstName}
        </p>
      </div>

      <div className="px-4 pb-8 sm:px-6 lg:px-8 space-y-6">
        {/* Active Job */}
        <ActiveJobCard workOrder={activeJob} />

        {/* Job Queue */}
        <JobQueueList technicianId={technicianId} siteId={siteId} />

        {/* Bottom row: PM + KPIs */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <TodaysPmList technicianId={technicianId} siteId={siteId} />
          <PersonalKpiCards technicianId={technicianId} siteId={siteId} />
        </div>
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
