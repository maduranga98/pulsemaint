import { useEffect, useMemo } from 'react';
import { useAuthStore } from '../../store/authStore';
import { useDashboardStore } from '../../store/dashboard.store';
import KpiCard from '../../components/dashboard/shared/KpiCard';

import MttrTrendChart from '../../components/dashboard/manager/MttrTrendChart';
import BreakdownByTypeChart from '../../components/dashboard/manager/BreakdownByTypeChart';
import BreakdownHeatmap from '../../components/dashboard/manager/BreakdownHeatmap';
import TopProblemMachinesChart from '../../components/dashboard/manager/TopProblemMachinesChart';
import MaintenanceCostChart from '../../components/dashboard/manager/MaintenanceCostChart';
import MtbfTable from '../../components/dashboard/manager/MtbfTable';
import TechnicianPerformanceTable from '../../components/dashboard/manager/TechnicianPerformanceTable';
import PmComplianceWidget from '../../components/dashboard/manager/PmComplianceWidget';
import ContractorScoreboard from '../../components/dashboard/manager/ContractorScoreboard';
import SlaGaugeWidget from '../../components/dashboard/manager/SlaGaugeWidget';
import ProductionDowntimeStrip from '../../components/dashboard/manager/ProductionDowntimeStrip';
import DashboardSidePanel from '../../components/dashboard/shared/DashboardSidePanel';
import { complianceColor } from '../../utils/analytics.utils';

export default function ManagerDashboard() {
  const companyId = useAuthStore((s) => s.userProfile?.companyId) ?? '';
  const firstName = useAuthStore((s) => s.userProfile?.fullName?.split(' ')[0]) ?? 'Manager';
  const monthly = useDashboardStore((s) => s.monthlyAnalytics);

  const currentMonth = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }, []);

  useEffect(() => {
    if (companyId) {
      useDashboardStore.getState().fetchMonthlyAnalytics(companyId, currentMonth);
    }
  }, [companyId, currentMonth]);

  const kpis = [
    {
      label: 'Total Breakdowns (MTD)',
      value: monthly?.totalBreakdowns ?? 0,
      color: 'blue' as const,
    },
    {
      label: 'MTTR (MTD)',
      value: (monthly?.avgMttrHours ?? 0).toFixed(1),
      unit: 'hrs',
      color: complianceColor(monthly?.avgMttrHours ? 100 - monthly.avgMttrHours * 10 : 100),
    },
    {
      label: 'MTBF Average',
      value: (monthly?.avgMtbfDays ?? 0).toFixed(0),
      unit: 'days',
      color: 'green' as const,
    },
    {
      label: 'PM Compliance',
      value: Math.round(monthly?.pmComplianceRate ?? 0),
      unit: '%',
      color: complianceColor(monthly?.pmComplianceRate ?? 0),
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
  ];

  return (
    <div className="min-h-full bg-[#0A1628] text-[#F0F4F8]">
      <div className="px-4 py-4 sm:px-6 lg:px-8">
        <h1 className="text-xl font-bold text-[#F0F4F8] font-[Sora]">Manager Dashboard</h1>
        <p className="text-sm text-[#8BA3BF] mt-0.5">
          Good {getGreeting()}, {firstName}
        </p>
      </div>

      <div className="px-4 pb-8 sm:px-6 lg:px-8 space-y-6">
        {/* Row 1: 6 KPI Cards */}
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

        {/* Row 3: Heatmap + Top Problem Machines + Cost */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <BreakdownHeatmap companyId={companyId} />
          <TopProblemMachinesChart companyId={companyId} month={currentMonth} />
          <MaintenanceCostChart companyId={companyId} month={currentMonth} />
        </div>

        {/* Row 4: MTBF Table + Technician Performance */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <MtbfTable companyId={companyId} />
          <TechnicianPerformanceTable companyId={companyId} month={currentMonth} />
        </div>

        {/* Row 5: PM Compliance + Contractor + SLA Gauge */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <PmComplianceWidget companyId={companyId} />
          <ContractorScoreboard companyId={companyId} month={currentMonth} />
          <SlaGaugeWidget companyId={companyId} />
        </div>

        {/* Row 6: Production Downtime */}
        <ProductionDowntimeStrip companyId={companyId} />
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
