import { useEffect, useMemo } from 'react';
import { useAuthStore } from '../../store/authStore';
import { useDashboardStore } from '../../store/dashboard.store';
import { useActiveBreakdowns } from '../../hooks/dashboard/useActiveBreakdowns';
import { useOpenWorkOrders } from '../../hooks/dashboard/useOpenWorkOrders';
import KpiCard from '../../components/dashboard/shared/KpiCard';

import MttrTrendChart from '../../components/dashboard/manager/MttrTrendChart';
import BreakdownByTypeChart from '../../components/dashboard/manager/BreakdownByTypeChart';
import BreakdownHeatmap from '../../components/dashboard/manager/BreakdownHeatmap';
import TopProblemMachinesChart from '../../components/dashboard/manager/TopProblemMachinesChart';
import ContractorScoreboard from '../../components/dashboard/manager/ContractorScoreboard';
import SlaGaugeWidget from '../../components/dashboard/manager/SlaGaugeWidget';
import TodayShiftsByDepartment from '../../components/dashboard/manager/TodayShiftsByDepartment';
import TeamPerformanceWidget from '../../components/dashboard/manager/TeamPerformanceWidget';
import DashboardSidePanel from '../../components/dashboard/shared/DashboardSidePanel';
import BacklogRiskWidget from '../../components/dashboard/manager/BacklogRiskWidget';
import MachinesNeedingAttentionCard from '../../components/dashboard/manager/MachinesNeedingAttentionCard';
import { complianceColor, activeBreakdownColor, openWoColor } from '../../utils/analytics.utils';

export default function ManagerDashboard() {
  const companyId = useAuthStore((s) => s.userProfile?.companyId) ?? '';
  const siteId = useAuthStore((s) => s.userProfile?.siteIds?.[0]) ?? companyId;
  const role = useAuthStore((s) => s.userProfile?.role);
  const firstName = useAuthStore((s) => s.userProfile?.fullName?.split(' ')[0]) ?? 'Manager';
  const dashboardTitle = role === 'admin' ? 'Admin Dashboard' : 'Manager Dashboard';
  const monthly = useDashboardStore((s) => s.monthlyAnalytics);

  const { count: todayBreakdowns } = useActiveBreakdowns(siteId);
  const { count: todayWorkOrders } = useOpenWorkOrders(siteId);

  const currentMonth = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }, []);

  useEffect(() => {
    if (companyId) {
      useDashboardStore.getState().fetchMonthlyAnalytics(companyId, currentMonth);
    }
  }, [companyId, currentMonth]);

  const totalMaintenances =
    (monthly?.totalBreakdowns ?? 0) +
    (monthly?.pmCompletedOnTime ?? 0) +
    (monthly?.pmMissed ?? 0);

  const kpis = [
    {
      label: 'Total Maintenances',
      value: totalMaintenances,
      color: 'cyan' as const,
    },
    {
      label: 'Total Breakdowns (MTD)',
      value: monthly?.totalBreakdowns ?? 0,
      color: 'blue' as const,
    },
    {
      label: 'Today Breakdowns',
      value: todayBreakdowns,
      color: activeBreakdownColor(todayBreakdowns),
    },
    {
      label: 'Today Work Orders',
      value: todayWorkOrders,
      color: openWoColor(todayWorkOrders),
    },
    {
      label: 'MTTR (MTD)',
      value: (monthly?.avgMttrHours ?? 0).toFixed(1),
      unit: 'hrs',
      color: complianceColor(monthly?.avgMttrHours ? 100 - monthly.avgMttrHours * 10 : 100),
    },
    {
      label: 'PM Compliance',
      value: Math.round(monthly?.pmComplianceRate ?? 0),
      unit: '%',
      color: complianceColor(monthly?.pmComplianceRate ?? 0),
    },
  ];

  return (
    <div className="min-h-full bg-[#0A1628] text-[#F0F4F8]">
      <div className="px-4 py-4 sm:px-6 lg:px-8">
        <h1 className="text-xl font-bold text-[#F0F4F8] font-[Sora]">{dashboardTitle}</h1>
        <p className="text-sm text-[#8BA3BF] mt-0.5">
          Good {getGreeting()}, {firstName}
        </p>
      </div>

      <div className="px-4 pb-8 sm:px-6 lg:px-8 space-y-6">
        {/* Row 1: KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {kpis.map((kpi, idx) => (
            <KpiCard key={idx} data={kpi as any} />
          ))}
        </div>

        {/* Row 2: MTTR Trend + Breakdown by Type */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8">
            <MttrTrendChart companyId={companyId} />
          </div>
          <div className="lg:col-span-4">
            <BreakdownByTypeChart companyId={companyId} />
          </div>
        </div>

        {/* Row 3: Heatmap + Top Problem Machines */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <BreakdownHeatmap companyId={companyId} />
          <TopProblemMachinesChart companyId={companyId} month={currentMonth} />
        </div>

        {/* Row 4: Today's Shifts by Department + Team Performance */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <TodayShiftsByDepartment companyId={companyId} />
          <TeamPerformanceWidget companyId={companyId} month={currentMonth} />
        </div>

        {/* Row 5: Contractor Scoreboard + SLA Gauge */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <ContractorScoreboard companyId={companyId} month={currentMonth} />
          <SlaGaugeWidget companyId={companyId} />
        </div>

        {/* Row 6: High-Risk Backlog + Machines Needing Attention (TCO) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <BacklogRiskWidget />
          <MachinesNeedingAttentionCard />
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
