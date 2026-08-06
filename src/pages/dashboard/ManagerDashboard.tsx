import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../store/authStore';
import { useDashboardStore } from '../../store/dashboard.store';
import { useActiveBreakdowns } from '../../hooks/dashboard/useActiveBreakdowns';
import { useOpenWorkOrders } from '../../hooks/dashboard/useOpenWorkOrders';
import KpiCard from '../../components/dashboard/shared/KpiCard';
import {
  DASHBOARD_RANGE_LABELS,
  monthsForDashboardRange,
} from '../../utils/analytics/dashboardRange';

import LiveShiftStatusWidget from '../../components/dashboard/manager/LiveShiftStatusWidget';
import FactoryFloorMap from '../../components/dashboard/supervisor/FactoryFloorMap';
import LiveBreakdownsWidget from '../../components/dashboard/manager/LiveBreakdownsWidget';
import LivePOsWidget from '../../components/dashboard/manager/LivePOsWidget';
import TodaySafetyCasesWidget from '../../components/dashboard/manager/TodaySafetyCasesWidget';
import TodayTrainingsWidget from '../../components/dashboard/manager/TodayTrainingsWidget';
import ExtensionRequestsWidget from '../../components/dashboard/shared/ExtensionRequestsWidget';
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
  const { t } = useTranslation();
  const userProfile = useAuthStore((s) => s.userProfile);
  const companyId = userProfile?.companyId ?? '';
  // Admin and plant manager are both plant-wide roles, so both resolve to the
  // company scope and see identical numbers on this dashboard.
  const siteId = resolveAnalyticsScopeId(userProfile);
  const role = userProfile?.role;
  const firstName = useAuthStore((s) => s.userProfile?.fullName?.split(' ')[0]) ?? 'Manager';
  const dashboardTitle = role === 'admin' ? t('common.dashboard.adminTitle') : t('common.dashboard.managerTitle');
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
      label: t('common.dashboard.kpi.totalMaintenances'),
      value: totalMaintenances,
      color: 'cyan' as const,
    },
    {
      label: t('common.dashboard.kpi.totalBreakdowns', { range: DASHBOARD_RANGE_LABELS[RANGE] }),
      value: monthly?.totalBreakdowns ?? 0,
      color: 'blue' as const,
    },
    {
      label: t('common.dashboard.kpi.todayBreakdowns'),
      value: todayBreakdowns,
      color: activeBreakdownColor(todayBreakdowns),
    },
    {
      label: t('common.dashboard.kpi.todayWorkOrders'),
      value: todayWorkOrders,
      color: openWoColor(todayWorkOrders),
    },
    {
      label: t('common.dashboard.kpi.mttr', { range: DASHBOARD_RANGE_LABELS[RANGE] }),
      value: (monthly?.avgMttrHours ?? 0).toFixed(1),
      unit: 'hrs',
      color: complianceColor(monthly?.avgMttrHours ? 100 - monthly.avgMttrHours * 10 : 100),
    },
    {
      label: t('common.dashboard.kpi.pmCompliance'),
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
            {t('common.dashboard.greeting.text', { time: t(`common.dashboard.greeting.${getGreeting()}`), name: firstName })}
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

        {/* Live factory floor: every machine with an open WO or breakdown. */}
        <FactoryFloorMap companyId={companyId} />

        {/* Live Breakdowns + Live PO Requests */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <LiveBreakdownsWidget siteId={siteId} />
          <LivePOsWidget />
        </div>

        {/* Today's Safety Cases + Today's Trainings (safety and general) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <TodaySafetyCasesWidget companyId={companyId} />
          <TodayTrainingsWidget companyId={companyId} />
        </div>

        {/* WO due-date extension requests awaiting approval */}
        <ExtensionRequestsWidget companyId={companyId} />

        {/* Who's actually on shift right now. Trend charts, heatmaps,
            per-machine/contractor breakdowns, SLA, and Safety/Team
            Performance analytics live exclusively on the Analytics tab —
            see AnalyticsPage. */}
        <LiveShiftStatusWidget companyId={companyId} />
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
