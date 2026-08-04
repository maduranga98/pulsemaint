import { useEffect, useMemo } from 'react';
import { useAuthStore } from '../../store/authStore';
import { useDashboardStore } from '../../store/dashboard.store';
import { useActiveBreakdowns } from '../../hooks/dashboard/useActiveBreakdowns';
import { useOpenWorkOrders } from '../../hooks/dashboard/useOpenWorkOrders';
import KpiCard from '../../components/dashboard/shared/KpiCard';
import {
  DASHBOARD_RANGE_LABELS,
  monthsForDashboardRange,
} from '../../utils/analytics/dashboardRange';

import TodayShiftsByDepartment from '../../components/dashboard/manager/TodayShiftsByDepartment';
import DashboardSidePanel from '../../components/dashboard/shared/DashboardSidePanel';
import { subscribeMonthlyAnalytics } from '../../services/analyticsAggregation';
import { complianceColor, activeBreakdownColor, openWoColor } from '../../utils/analytics.utils';
import { resolveAnalyticsScopeId } from '../../lib/analytics/analyticsScope';

// This dashboard always shows live, current-month figures — the trend
// charts, heatmaps, and per-machine/contractor breakdowns that used to
// duplicate the Analytics tab (with its own date-range picker) now live
// there exclusively; see AnalyticsPage.
const RANGE = 'mtd' as const;

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

  const months = useMemo(() => monthsForDashboardRange(RANGE), []);
  const monthsKey = months.join(',');

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
      label: `Total Breakdowns (${DASHBOARD_RANGE_LABELS[RANGE]})`,
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
      label: `MTTR (${DASHBOARD_RANGE_LABELS[RANGE]})`,
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
      </div>

      <div className="px-4 pb-8 sm:px-6 lg:px-8 space-y-6">
        {/* Row 1: KPI Cards — live current-month figures */}
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {kpis.map((kpi, idx) => (
            <KpiCard key={idx} data={kpi as any} />
          ))}
        </div>

        {/* Today's Shifts by Department. Trend charts, heatmaps, per-machine/
            contractor breakdowns, SLA, and Safety/Team Performance analytics
            now live exclusively on the Analytics tab — see AnalyticsPage. */}
        <TodayShiftsByDepartment companyId={companyId} />
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
