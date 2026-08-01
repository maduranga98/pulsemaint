import { useEffect, useMemo, useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import { useDashboardStore } from '../../store/dashboard.store';
import { useActiveBreakdowns } from '../../hooks/dashboard/useActiveBreakdowns';
import { useOpenWorkOrders } from '../../hooks/dashboard/useOpenWorkOrders';
import KpiCard from '../../components/dashboard/shared/KpiCard';
import {
  DASHBOARD_RANGE_LABELS,
  monthsForDashboardRange,
  type DashboardRange,
} from '../../utils/analytics/dashboardRange';

import MttrTrendChart from '../../components/dashboard/manager/MttrTrendChart';
import BreakdownByTypeChart from '../../components/dashboard/manager/BreakdownByTypeChart';
import BreakdownHeatmap from '../../components/dashboard/manager/BreakdownHeatmap';
import TopProblemMachinesChart from '../../components/dashboard/manager/TopProblemMachinesChart';
import ContractorScoreboard from '../../components/dashboard/manager/ContractorScoreboard';
import SlaGaugeWidget from '../../components/dashboard/manager/SlaGaugeWidget';
import TodayShiftsByDepartment from '../../components/dashboard/manager/TodayShiftsByDepartment';
import TeamPerformanceAnalyticsWidget from '../../components/dashboard/manager/TeamPerformanceAnalyticsWidget';
import DashboardSidePanel from '../../components/dashboard/shared/DashboardSidePanel';
import SafetySnapshotWidget from '../../components/dashboard/manager/SafetySnapshotWidget';
import { ShieldAlert } from 'lucide-react';
import { subscribeMonthlyAnalytics } from '../../services/analyticsAggregation';
import { complianceColor, activeBreakdownColor, openWoColor } from '../../utils/analytics.utils';
import { resolveAnalyticsScopeId } from '../../lib/analytics/analyticsScope';

export default function ManagerDashboard() {
  const userProfile = useAuthStore((s) => s.userProfile);
  const companyId = userProfile?.companyId ?? '';
  // Admin and plant manager are both plant-wide roles, so both resolve to the
  // company scope and see identical numbers on this dashboard.
  const siteId = resolveAnalyticsScopeId(userProfile);
  const role = userProfile?.role;
  const firstName = useAuthStore((s) => s.userProfile?.fullName?.split(' ')[0]) ?? 'Manager';
  const dashboardTitle = role === 'admin' ? 'Admin Dashboard' : 'Manager Dashboard';
  const monthly = useDashboardStore((s) => s.monthlyAnalytics);

  const { count: todayBreakdowns } = useActiveBreakdowns(siteId);
  const { count: todayWorkOrders } = useOpenWorkOrders(siteId);

  const [range, setRange] = useState<DashboardRange>('mtd');
  // The months covered by the selected range drive the monthly-aggregate
  // KPIs below (Total Breakdowns, MTTR, PM Compliance) — same range control
  // as the Analytics page, backed by the same buildMonthlyAnalytics pipeline.
  const months = useMemo(() => monthsForDashboardRange(range), [range]);
  const monthsKey = months.join(',');
  const currentMonth = months[months.length - 1];

  useEffect(() => {
    if (!companyId) return;
    // Live subscription so the KPIs and breakdown-distribution chart update
    // automatically as breakdowns / work orders / PM records change.
    const unsub = subscribeMonthlyAnalytics(companyId, months, (data) => {
      useDashboardStore.getState().setMonthlyAnalytics(data);
    });
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, monthsKey]);

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
      label: `Total Breakdowns (${DASHBOARD_RANGE_LABELS[range]})`,
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
      label: `MTTR (${DASHBOARD_RANGE_LABELS[range]})`,
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
      <div className="px-4 py-4 sm:px-6 lg:px-8 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[#F0F4F8] font-[Sora]">{dashboardTitle}</h1>
          <p className="text-sm text-[#8BA3BF] mt-0.5">
            Good {getGreeting()}, {firstName}
          </p>
        </div>
        <div className="inline-flex rounded-lg border border-[#1E3A5F] bg-[#0F1E35] p-1 text-xs">
          {(Object.keys(DASHBOARD_RANGE_LABELS) as DashboardRange[]).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              className={`px-3 py-1.5 rounded-md font-medium transition ${
                range === r ? 'bg-[#1A56DB] text-white' : 'text-[#8BA3BF] hover:text-[#F0F4F8]'
              }`}
            >
              {DASHBOARD_RANGE_LABELS[r]}
            </button>
          ))}
        </div>
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
          <TopProblemMachinesChart companyId={companyId} month={months} />
        </div>

        {/* Row 4: Today's Shifts by Department + Team Performance (from Evaluations) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <TodayShiftsByDepartment companyId={companyId} />
          <TeamPerformanceAnalyticsWidget companyId={companyId} />
        </div>

        {/* Row 5: Contractor Scoreboard + SLA Gauge */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <ContractorScoreboard companyId={companyId} month={currentMonth} />
          <SlaGaugeWidget companyId={companyId} />
        </div>

        {/* Row 6: Safety Analytics snapshot (formerly the Safety Analytics tab) */}
        <div className="space-y-4">
          <h2 className="flex items-center gap-2 font-[Sora] text-lg font-bold text-[#F0F4F8]">
            <ShieldAlert className="h-5 w-5 text-[#F59E0B]" /> Safety Analytics
          </h2>
          <SafetySnapshotWidget companyId={companyId} />
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
