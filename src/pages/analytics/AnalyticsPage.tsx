import { useEffect, useMemo, useState } from 'react';
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
import { complianceColor } from '../../utils/analytics.utils';

type Range = 'mtd' | '3m' | '6m' | '12m';

export default function AnalyticsPage() {
  const companyId = useAuthStore((s) => s.userProfile?.companyId) ?? '';
  const monthly = useDashboardStore((s) => s.monthlyAnalytics);
  const [range, setRange] = useState<Range>('mtd');

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
      label: 'Total Breakdowns',
      value: monthly?.totalBreakdowns ?? 0,
      color: 'blue' as const,
    },
    {
      label: 'MTTR',
      value: (monthly?.avgMttrHours ?? 0).toFixed(1),
      unit: 'hrs',
      color: complianceColor(monthly?.avgMttrHours ? 100 - monthly.avgMttrHours * 10 : 100),
    },
    {
      label: 'MTBF',
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
    {
      label: 'SLA Compliance',
      value: Math.round(monthly?.overallSlaCompliance ?? 0),
      unit: '%',
      color: complianceColor(monthly?.overallSlaCompliance ?? 0),
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
              {r === 'mtd' ? 'MTD' : r === '3m' ? '3M' : r === '6m' ? '6M' : '12M'}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pb-8 sm:px-6 lg:px-8 space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 gap-4">
          {kpis.map((kpi, idx) => (
            <KpiCard key={idx} data={kpi as any} />
          ))}
        </div>

        <ProductionDowntimeStrip companyId={companyId} />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8">
            <MttrTrendChart companyId={companyId} />
          </div>
          <div className="lg:col-span-4">
            <BreakdownByTypeChart companyId={companyId} />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-6">
            <BreakdownHeatmap companyId={companyId} />
          </div>
          <div className="lg:col-span-6">
            <TopProblemMachinesChart companyId={companyId} />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8">
            <MaintenanceCostChart companyId={companyId} />
          </div>
          <div className="lg:col-span-4">
            <SlaGaugeWidget companyId={companyId} />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-6">
            <MtbfTable companyId={companyId} />
          </div>
          <div className="lg:col-span-6">
            <TechnicianPerformanceTable companyId={companyId} />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-6">
            <PmComplianceWidget companyId={companyId} />
          </div>
          <div className="lg:col-span-6">
            <ContractorScoreboard companyId={companyId} />
          </div>
        </div>
      </div>
    </div>
  );
}
