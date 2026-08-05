import { useMemo } from 'react';
import { useAuthStore } from '../../store/authStore';
import { useActiveBreakdowns } from '../../hooks/dashboard/useActiveBreakdowns';
import { useOpenWorkOrders } from '../../hooks/dashboard/useOpenWorkOrders';
import { useMttrToday } from '../../hooks/dashboard/useMttrToday';
import KpiCard from '../../components/dashboard/shared/KpiCard';
import KpiStrip from '../../components/dashboard/shared/KpiStrip';
import BreakdownKanbanBoard from '../../components/dashboard/supervisor/BreakdownKanbanBoard';
import WorkOrdersWidget from '../../components/dashboard/supervisor/WorkOrdersWidget';
import FactoryFloorMap from '../../components/dashboard/supervisor/FactoryFloorMap';
import TechnicianStatusList from '../../components/dashboard/supervisor/TechnicianStatusList';
import AssignedTasksWidget from '../../components/dashboard/supervisor/AssignedTasksWidget';
import ExtensionRequestsWidget from '../../components/dashboard/shared/ExtensionRequestsWidget';
import DashboardSidePanel from '../../components/dashboard/shared/DashboardSidePanel';
import { activeBreakdownColor, mttrColor, openWoColor, formatDurationHours } from '../../utils/analytics.utils';

export default function SupervisorDashboard() {
  const companyId = useAuthStore((s) => s.userProfile?.companyId) ?? '';
  const siteId = useAuthStore((s) => s.userProfile?.siteIds?.[0]) ?? companyId;
  const firstName = useAuthStore((s) => s.userProfile?.fullName?.split(' ')[0]) ?? 'Supervisor';

  const { count: activeBreakdowns } = useActiveBreakdowns(siteId);
  const { count: openWos } = useOpenWorkOrders(siteId);
  const { mttrHours } = useMttrToday(siteId);

  const shiftStart = useMemo(() => {
    const now = new Date();
    now.setHours(8, 0, 0, 0);
    return now;
  }, []);

  const shiftElapsedHours = useMemo(() => {
    const diffMs = Date.now() - shiftStart.getTime();
    return Math.max(0, diffMs / (1000 * 60 * 60));
  }, [shiftStart]);

  const kpiCards = [
    {
      label: 'Active Breakdowns',
      value: activeBreakdowns,
      color: activeBreakdownColor(activeBreakdowns),
    },
    {
      label: 'MTTR Today',
      value: formatDurationHours(mttrHours),
      unit: 'hrs',
      color: mttrColor(mttrHours, 4),
    },
    {
      label: 'Open Work Orders',
      value: openWos,
      color: openWoColor(openWos),
    },
    {
      label: 'Shift Hours Elapsed',
      value: Math.floor(shiftElapsedHours),
      unit: 'h',
      color: 'cyan' as const,
    },
  ];

  return (
    <div className="min-h-full bg-[#0A1628] text-[#F0F4F8]">
      {/* Header */}
      <div className="px-4 py-4 sm:px-6 lg:px-8">
        <h1 className="text-xl font-bold text-[#F0F4F8] font-[Sora]">
          Supervisor Dashboard
        </h1>
        <p className="text-sm text-[#8BA3BF] mt-0.5">
          Good {getGreeting()}, {firstName}
        </p>
      </div>

      <div className="px-4 pb-8 sm:px-6 lg:px-8 space-y-6">
        {/* Row 1: KPI Strip */}
        <KpiStrip>
          {kpiCards.map((kpi, idx) => (
            <KpiCard key={idx} data={kpi as any} />
          ))}
        </KpiStrip>

        {/* Row 2: Kanban + Work Orders */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8">
            <BreakdownKanbanBoard companyId={companyId} />
          </div>
          <div className="lg:col-span-4">
            <WorkOrdersWidget siteId={siteId} />
          </div>
        </div>

        {/* Row 3: Floor Map + Tech Status */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FactoryFloorMap companyId={companyId} />
          <TechnicianStatusList companyId={companyId} />
        </div>

        {/* Row 3b: WO due-date extension requests awaiting approval */}
        <ExtensionRequestsWidget companyId={companyId} />

        {/* Row 4: Assigned WOs / Audits / Evaluations / Trainings (today's shift) */}
        <AssignedTasksWidget />
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
