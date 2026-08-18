import { useAuthStore } from '../../store/authStore';
import ReportBreakdownWidget from '../../components/dashboard/floorOperator/ReportBreakdownWidget';
import MyDepartmentBreakdownsWidget from '../../components/dashboard/floorOperator/MyDepartmentBreakdownsWidget';
import MyTrainingsWidget from '../../components/dashboard/technician/MyTrainingsWidget';
import MySafetyTrainingsWidget from '../../components/dashboard/technician/MySafetyTrainingsWidget';
import MySafetyCasesWidget from '../../components/dashboard/technician/MySafetyCasesWidget';

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

// Floor operator's landing page. Everything here used to be spread across
// standalone nav tabs (Breakdowns, Safety Cases, Safety Training Schedules)
// — now consolidated into dashboard widgets, and those tabs removed from
// their sidebar (see AppLayout's NAV_GROUPS) so this is the one place they
// check instead of hunting across sections.
export default function FloorOperatorDashboard() {
  const userProfile = useAuthStore((s) => s.userProfile);
  const siteId = userProfile?.siteIds?.[0] ?? userProfile?.companyId ?? '';
  const firstName = userProfile?.fullName?.split(' ')[0] ?? 'there';

  return (
    <div className="min-h-full bg-[#0A1628] text-[#F0F4F8]">
      <div className="px-4 py-4 sm:px-6 lg:px-8">
        <h1 className="text-xl font-bold text-[#F0F4F8] font-[Sora]">Dashboard</h1>
        <p className="text-sm text-[#8BA3BF] mt-0.5">{getGreeting()}, {firstName}.</p>
      </div>

      <div className="px-4 pb-8 sm:px-6 lg:px-8 space-y-6">
        <ReportBreakdownWidget />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <MyDepartmentBreakdownsWidget siteId={siteId} />
          <MyTrainingsWidget />
        </div>

        <MySafetyTrainingsWidget />

        <MySafetyCasesWidget />
      </div>
    </div>
  );
}
