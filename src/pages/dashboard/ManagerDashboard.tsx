import { useEffect, useMemo } from 'react';
import { IncompleteDataBanner } from '../../components/analytics/IncompleteDataBanner';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../store/authStore';
import { useDashboardStore } from '../../store/dashboard.store';
import { useActiveBreakdowns } from '../../hooks/dashboard/useActiveBreakdowns';
import { useOpenWorkOrders } from '../../hooks/dashboard/useOpenWorkOrders';
import { useDepartmentScope } from '../../hooks/useDepartmentScope';
import KpiCard from '../../components/dashboard/shared/KpiCard';
import {
  DASHBOARD_RANGE_LABELS,
  monthsForDashboardRange,
} from '../../utils/analytics/dashboardRange';

import LiveShiftStatusWidget from '../../components/dashboard/manager/LiveShiftStatusWidget';
import FactoryFloorMap from '../../components/dashboard/supervisor/FactoryFloorMap';
import PlantOverviewWidget from '../../components/dashboard/manager/PlantOverviewWidget';
import TodaysPmWidget from '../../components/dashboard/supervisor/TodaysPmWidget';
import LivePOsWidget from '../../components/dashboard/manager/LivePOsWidget';
import OpenSafetyCasesWidget from '../../components/dashboard/manager/OpenSafetyCasesWidget';
import TodayTrainingsWidget from '../../components/dashboard/manager/TodayTrainingsWidget';
import ProgrammeSignOffQueueWidget from '../../components/dashboard/training/ProgrammeSignOffQueueWidget';
import MyTrainingsWidget from '../../components/dashboard/technician/MyTrainingsWidget';
import PendingApprovalsWidget from '../../components/dashboard/supervisor/PendingApprovalsWidget';
import NeedSignOffWidget from '../../components/dashboard/supervisor/NeedSignOffWidget';
import MandatoryFeedbackModal from '../../components/support/MandatoryFeedbackModal';
import DashboardSidePanel from '../../components/dashboard/shared/DashboardSidePanel';
import { subscribeMonthlyAnalytics } from '../../services/analyticsAggregation';
import { complianceColor, activeBreakdownColor, openWoColor } from '../../utils/analytics.utils';
import { resolveAnalyticsScopeId } from '../../lib/analytics/analyticsScope';
import { isWoWorkStarted } from '../../lib/machineWorkState';
import { usePlants } from '../../hooks/usePlants';

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
  // Safety officer shares this dashboard with admin/plant manager, but the
  // header should still read as theirs — same page, correct role identity.
  const dashboardTitle =
    role === 'admin' ? t('common.dashboard.adminTitle')
    : role === 'safety_officer' ? t('common.dashboard.safetyOfficerTitle')
    : t('common.dashboard.managerTitle');
  const monthly = useDashboardStore((s) => s.monthlyAnalytics);
  // Plant manager/safety officer are locked to their own plant; admin follows
  // the plant tab (null = All Plants).
  const { plantId } = useDepartmentScope();

  const { breakdowns: activeBreakdowns, count: todayBreakdowns } = useActiveBreakdowns(siteId);
  const { workOrders: openWorkOrders, count: todayWorkOrders } = useOpenWorkOrders(siteId);
  const unassignedBreakdowns = activeBreakdowns.filter((b) => (b.assignedTechnicianIds ?? []).length === 0).length;
  const startedWorkOrders = openWorkOrders.filter((w) => isWoWorkStarted(w.status)).length;

  const months = useMemo(() => monthsForDashboardRange(RANGE), []);
  const monthsKey = months.join(',');

  useEffect(() => {
    if (!companyId) return;
    // Live subscription so the KPIs and breakdown-distribution chart update
    // automatically as breakdowns / work orders / PM records change.
    const unsub = subscribeMonthlyAnalytics(companyId, months, (data) => {
      useDashboardStore.getState().setMonthlyAnalytics(data);
    }, plantId);
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, monthsKey, plantId]);

  const totalMaintenances =
    (monthly?.totalBreakdowns ?? 0) +
    (monthly?.pmCompletedOnTime ?? 0) +
    (monthly?.pmMissed ?? 0);

  const kpis = [
    {
      label: t('common.dashboard.kpi.totalMaintenances'),
      value: totalMaintenances,
      color: 'cyan' as const,
      scope: 'mtd' as const,
      subtitle: t('common.dashboard.kpiSub.maintenances', { defaultValue: 'breakdowns + PM this month' }),
    },
    {
      label: t('common.dashboard.kpi.totalBreakdowns', { range: DASHBOARD_RANGE_LABELS[RANGE] }),
      value: monthly?.totalBreakdowns ?? 0,
      color: 'blue' as const,
      scope: 'mtd' as const,
      subtitle: t('common.dashboard.kpiSub.thisMonth', { defaultValue: 'this month' }),
    },
    {
      label: t('common.dashboard.kpi.todayBreakdowns'),
      value: todayBreakdowns,
      color: activeBreakdownColor(todayBreakdowns),
      scope: 'today' as const,
      subtitle: unassignedBreakdowns > 0
        ? t('common.dashboard.kpiSub.unassigned', { count: unassignedBreakdowns, defaultValue: '{{count}} unassigned' })
        : undefined,
      subtitleTone: 'red' as const,
    },
    {
      label: t('common.dashboard.kpi.todayWorkOrders'),
      value: todayWorkOrders,
      color: openWoColor(todayWorkOrders),
      scope: 'today' as const,
      subtitle: todayWorkOrders > 0
        ? t('common.dashboard.kpiSub.startedSplit', {
            started: startedWorkOrders,
            notStarted: todayWorkOrders - startedWorkOrders,
            defaultValue: '{{started}} started · {{notStarted}} not started',
          })
        : undefined,
      subtitleTone: 'amber' as const,
    },
    {
      label: t('common.dashboard.kpi.mttr', { range: DASHBOARD_RANGE_LABELS[RANGE] }),
      value: (monthly?.avgMttrHours ?? 0).toFixed(1),
      unit: 'hrs',
      color: complianceColor(monthly?.avgMttrHours ? 100 - monthly.avgMttrHours * 10 : 100),
      scope: 'mtd' as const,
      subtitle: t('common.dashboard.kpiSub.avgRepair', { defaultValue: 'average repair time' }),
    },
    {
      label: t('common.dashboard.kpi.pmCompliance'),
      value: Math.round(monthly?.pmComplianceRate ?? 0),
      unit: '%',
      color: complianceColor(monthly?.pmComplianceRate ?? 0),
      scope: 'mtd' as const,
      subtitle: (monthly?.pmMissed ?? 0) > 0
        ? t('common.dashboard.kpiSub.pmOverdue', { count: monthly?.pmMissed ?? 0, defaultValue: '{{count}} overdue' })
        : undefined,
      subtitleTone: 'red' as const,
    },
  ];

  const { plants } = usePlants(companyId);
  const scopeName = plantId
    ? plants.find((pl) => pl.id === plantId)?.name ?? ''
    : t('common.dashboard.allPlants', { defaultValue: 'All plants' });
  const dateLine = [
    new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' }),
    scopeName,
  ].filter(Boolean).join(' · ');

  return (
    <div className="min-h-full bg-[#0A1628] text-[#F0F4F8]">
      <div className="pb-4">
        <p className="text-xs font-medium text-[#8BA3BF]">{dateLine}</p>
        <h1 className="mt-1 text-xl font-bold text-[#F0F4F8]">{dashboardTitle}</h1>
        <p className="mt-0.5 text-sm text-[#8BA3BF]">
          {t('common.dashboard.greeting.text', { time: t(`common.dashboard.greeting.${getGreeting()}`), name: firstName })}
        </p>
      </div>

      <IncompleteDataBanner sources={monthly?.incompleteSources} />

      <div className="pb-8 space-y-6">
        {/* Key numbers: month-to-date and today, each tagged. Two across on a
            phone, six across on a wide screen. */}
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
          {kpis.map((kpi, idx) => (
            <KpiCard key={idx} data={kpi as any} />
          ))}
        </div>

        {/* All Plants view: per-plant breakdown so every number has a plant. */}
        <PlantOverviewWidget siteId={siteId} companyId={companyId} />

        {/* Wide screens: main column (2/3) + right rail (1/3). On a phone
            everything stacks — main column first, then the rail. Only
            Pending approvals, Need sign-off, Programme sign-off and PO
            requests carry buttons; every other card is an indication. */}
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-6 items-start">
          <div className="space-y-6 min-w-0">
            {/* Machines with a breakdown or a started work order. */}
            <FactoryFloorMap companyId={companyId} />

            {/* PM work orders due today / overdue */}
            <TodaysPmWidget siteId={siteId} />

            {/* Purchase order requests */}
            <LivePOsWidget />

            {/* Pending WO approval requests + completed WOs awaiting sign-off —
                admin/plant_manager get the same widgets as supervisor
                (SupervisorDashboard), replacing the Work Orders page's
                "Approval Requests" and "Need Sign-Off" tabs (removed there).
                Not shown to safety_officer, who shares this dashboard but isn't
                part of the WO sign-off workflow. */}
            {(role === 'admin' || role === 'plant_manager') && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <PendingApprovalsWidget />
                <NeedSignOffWidget />
              </div>
            )}
          </div>

          <div className="space-y-6 min-w-0">
            <OpenSafetyCasesWidget companyId={companyId} />
            <TodayTrainingsWidget companyId={companyId} />

            {/* Trainees ready for their programme completion sign-off */}
            <ProgrammeSignOffQueueWidget companyId={companyId} />

            {/* Plant manager's and safety officer's own outstanding trainings —
                admin doesn't get personal training assignments, so this is
                scoped to those two roles, replacing their old "My Training"
                nav tab. */}
            {(role === 'plant_manager' || role === 'safety_officer') && <MyTrainingsWidget readOnly />}

            {/* Who is on shift, by department. Trend charts, heatmaps and
                per-machine/contractor breakdowns live on the Analytics tab. */}
            <LiveShiftStatusWidget companyId={companyId} />
          </div>
        </div>
      </div>

      {/* Company admins can't dismiss this until they've rated the system. */}
      {role === 'admin' && <MandatoryFeedbackModal />}

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
