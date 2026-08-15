import { useEffect, useMemo, useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import { useDashboardStore } from '../../store/dashboard.store';
import { subscribeMonthlyAnalytics } from '../../services/analyticsAggregation';
import { useSafetyKpis } from '@/hooks/safety/useSafety';
import InventoryAnalyticsPage from './InventoryAnalyticsPage';
import HrAnalyticsPage from './HrAnalyticsPage';
import KpiCard from '../../components/dashboard/shared/KpiCard';
import MttrTrendChart from '../../components/dashboard/manager/MttrTrendChart';
import BreakdownByTypeChart from '../../components/dashboard/manager/BreakdownByTypeChart';
import TopProblemMachinesChart from '../../components/dashboard/manager/TopProblemMachinesChart';
import MaintenanceCostChart from '../../components/dashboard/manager/MaintenanceCostChart';
import TechnicianPerformanceTable from '../../components/dashboard/manager/TechnicianPerformanceTable';
import PmComplianceWidget from '../../components/dashboard/manager/PmComplianceWidget';
import PmTrendChart from '../../components/dashboard/manager/PmTrendChart';
import WoTypeDistributionChart from '../../components/dashboard/manager/WoTypeDistributionChart';
import ContractorScoreboard from '../../components/dashboard/manager/ContractorScoreboard';
import ProductionDowntimeStrip from '../../components/dashboard/manager/ProductionDowntimeStrip';
import TopPerformersWidget from '../../components/dashboard/manager/TopPerformersWidget';
import SafetySnapshotWidget from '../../components/dashboard/manager/SafetySnapshotWidget';
import { resolveAnalyticsScopeId } from '../../lib/analytics/analyticsScope';
import {
  DASHBOARD_RANGE_LABELS,
  monthsForDashboardRange,
  type DashboardRange as Range,
} from '../../utils/analytics/dashboardRange';

type Tab = 'breakdowns' | 'pm' | 'workorders' | 'machines' | 'safety' | 'team';

const TABS: { value: Tab; label: string }[] = [
  { value: 'breakdowns', label: 'Breakdowns' },
  { value: 'pm', label: 'Preventive Maintenance' },
  { value: 'workorders', label: 'Work Orders' },
  { value: 'machines', label: 'Machines' },
  { value: 'safety', label: 'Safety' },
  { value: 'team', label: 'Team Performance' },
];

export default function AnalyticsPage() {
  // workOrders (and the charts fed from it — Work Order distribution,
  // Maintenance Cost Overview) are scoped by siteId, not companyId; for a
  // multi-site user those differ, so resolve the scope the same way the rest
  // of the app does. Admin and plant manager both resolve to the company
  // scope, so the two roles see identical analytics for the same plant.
  const userProfile = useAuthStore((s) => s.userProfile);
  // Store keeper / HR officer get dedicated analytics views instead of the
  // manager-oriented dashboard below — bail out before any of this
  // component's other hooks run.
  if (userProfile?.role === 'store_keeper') return <InventoryAnalyticsPage />;
  if (userProfile?.role === 'hr_officer') return <HrAnalyticsPage />;

  const companyId = resolveAnalyticsScopeId(userProfile);
  const monthly = useDashboardStore((s) => s.monthlyAnalytics);
  const { kpis: safetyKpis } = useSafetyKpis(companyId);
  const [range, setRange] = useState<Range>('mtd');
  const [tab, setTab] = useState<Tab>('breakdowns');

  // The months covered by the selected range drive every range-aware section.
  const months = useMemo(() => monthsForDashboardRange(range), [range]);
  const monthsKey = months.join(',');

  useEffect(() => {
    if (!companyId) return;
    const unsub = subscribeMonthlyAnalytics(companyId, months, (data) => {
      useDashboardStore.getState().setMonthlyAnalytics(data);
    });
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, monthsKey]);

  const kpis = [
    {
      label: 'Total Breakdowns',
      value: monthly?.totalBreakdowns ?? 0,
      color: 'blue' as const,
    },
    {
      label: 'Maintenance Cost',
      value: `LKR ${((monthly?.totalMaintenanceCost ?? 0) / 1000).toFixed(0)}K`,
      color: 'amber' as const,
    },
    {
      label: 'Hours Lost',
      value: (monthly?.totalProductionHoursLost ?? 0).toFixed(0),
      unit: 'h',
      color: 'red' as const,
    },
    {
      label: 'Safety Cases',
      value: safetyKpis.totalCases,
      color: (safetyKpis.openCases > 0 ? 'amber' : 'green') as 'amber' | 'green',
    },
  ];

  return (
    <div className="min-h-full bg-[#0A1628] text-[#F0F4F8]">
      <div className="px-4 py-4 sm:px-6 lg:px-8 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[#F0F4F8] font-[Sora]">Analytics</h1>
          <p className="text-sm text-[#8BA3BF] mt-0.5">
            Operational performance, reliability, and cost trends across your fleet.
          </p>
        </div>
        <div className="inline-flex rounded-lg border border-[#1E3A5F] bg-[#0F1E35] p-1 text-xs">
          {(['mtd', '3m', '6m', '12m'] as Range[]).map((r) => (
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
        {/* KPI Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {kpis.map((kpi, idx) => (
            <KpiCard key={idx} data={kpi as any} />
          ))}
        </div>

        <ProductionDowntimeStrip companyId={companyId} />

        {/* Section tabs */}
        <div className="flex flex-wrap gap-1 border-b border-[#1E3A5F]">
          {TABS.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setTab(t.value)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                tab === t.value
                  ? 'border-[#1A56DB] text-[#F0F4F8]'
                  : 'border-transparent text-[#8BA3BF] hover:text-[#F0F4F8]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'breakdowns' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7">
              <MttrTrendChart companyId={companyId} range={range} />
            </div>
            <div className="lg:col-span-5">
              <BreakdownByTypeChart companyId={companyId} />
            </div>
          </div>
        )}

        {tab === 'pm' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8">
              <PmTrendChart companyId={companyId} months={months} />
            </div>
            <div className="lg:col-span-4">
              <PmComplianceWidget companyId={companyId} />
            </div>
          </div>
        )}

        {tab === 'workorders' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-6">
                <WoTypeDistributionChart companyId={companyId} months={months} />
              </div>
              <div className="lg:col-span-6">
                <MaintenanceCostChart companyId={companyId} month={months} />
              </div>
            </div>
            <ContractorScoreboard companyId={companyId} month={months} />
          </div>
        )}

        {tab === 'machines' && <TopProblemMachinesChart companyId={companyId} month={months} />}

        {tab === 'safety' && <SafetySnapshotWidget companyId={companyId} hideKpiCards />}

        {tab === 'team' && (
          <div className="space-y-6">
            <TechnicianPerformanceTable companyId={companyId} month={months} />
            <TopPerformersWidget companyId={companyId} />
          </div>
        )}
      </div>
    </div>
  );
}
