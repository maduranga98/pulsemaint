import { useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import ReportCard from '../../components/reports/ReportCard';
import ReportCategoryTabs, { type ReportCategoryTab } from '../../components/reports/ReportCategoryTabs';
import ReportConfigPanel from '../../components/reports/ReportConfigPanel';
import ReportSearchBar from '../../components/reports/ReportSearchBar';
import { useAuthStore } from '../../store/authStore';
import { useReportsStore } from '../../store/reports.store';
import { REPORT_LIST } from '../../utils/reports/reportDefinitions';
import { filterReportTypesForRole } from '../../utils/reports/reportAccess';

export default function ReportsHubPage() {
  const canAccess = useAuthStore((state) => state.canAccess(['safety_officer', 'supervisor', 'plant_manager', 'store_keeper', 'hr_officer', 'admin']));
  const role = useAuthStore((state) => state.userProfile?.role);
  const openConfigPanel = useReportsStore((state) => state.openConfigPanel);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<ReportCategoryTab>('all');

  // SLA Compliance, PM Compliance, Low Stock Alert, Machine Health Score,
  // Safety Incidents, and Executive Monthly reports have been retired from
  // the hub.
  const HIDDEN_REPORTS = new Set([
    'sla_compliance',
    'pm_compliance',
    'low_stock_alert',
    'machine_health_score',
    'safety_incidents',
    'executive_monthly',
  ]);
  const reports = useMemo(() => {
    const allowedTypes = new Set(
      filterReportTypesForRole(REPORT_LIST.map((r) => r.type), role)
    );
    return REPORT_LIST.filter((report) => {
      if (HIDDEN_REPORTS.has(report.type)) return false;
      if (!allowedTypes.has(report.type)) return false;
      const matchesSearch = report.name.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = category === 'all' || report.category === category;
      return matchesSearch && matchesCategory;
    });
  }, [category, search, role]);

  if (!canAccess) return <Navigate to="/app/dashboard" replace />;

  return (
    <div className="min-h-screen bg-[#0A1628] p-4 text-[#F0F4F8] sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header>
          <h1 className="font-[Sora] text-[28px] font-bold text-[#F0F4F8]">Reports</h1>
          <p className="mt-1 text-sm text-[#8BA3BF]">Generate, export, and schedule operational reports</p>
        </header>

        <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
          <ReportSearchBar value={search} onChange={setSearch} />
        </div>
        <ReportCategoryTabs active={category} onChange={setCategory} />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {reports.map((report) => (
            <ReportCard key={report.type} report={report} onGenerate={openConfigPanel} />
          ))}
        </div>

        {reports.length === 0 && (
          <div className="rounded-xl border border-[#1E3A5F] bg-[#0F1E35] p-10 text-center text-sm text-[#8BA3BF]">
            No reports match your search.
          </div>
        )}
      </div>
      <ReportConfigPanel />
    </div>
  );
}
