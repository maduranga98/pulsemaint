import { useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Clock } from 'lucide-react';
import ReportCard from '../../components/reports/ReportCard';
import ReportCategoryTabs, { type ReportCategoryTab } from '../../components/reports/ReportCategoryTabs';
import ReportConfigPanel from '../../components/reports/ReportConfigPanel';
import ReportSearchBar from '../../components/reports/ReportSearchBar';
import { useAuthStore } from '../../store/authStore';
import { useReportsStore } from '../../store/reports.store';
import { REPORT_LIST } from '../../utils/reports/reportDefinitions';

export default function ReportsHubPage() {
  const canAccess = useAuthStore((state) => state.canAccess(['supervisor', 'plant_manager', 'store_keeper', 'hr_officer', 'admin']));
  const openConfigPanel = useReportsStore((state) => state.openConfigPanel);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<ReportCategoryTab>('all');

  const reports = useMemo(() => REPORT_LIST.filter((report) => {
    const matchesSearch = report.name.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = category === 'all' || report.category === category;
    return matchesSearch && matchesCategory;
  }), [category, search]);

  if (!canAccess) return <Navigate to="/app/dashboard" replace />;

  return (
    <div className="min-h-screen bg-[#0A1628] p-4 text-[#F0F4F8] sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="font-[Sora] text-[28px] font-bold text-[#F0F4F8]">Reports</h1>
            <p className="mt-1 text-sm text-[#8BA3BF]">Generate, export, and schedule operational reports</p>
          </div>
          <Link to="/app/reports/history" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-[#1E3A5F] bg-[#0F1E35] px-4 text-sm font-semibold text-[#F0F4F8] hover:border-[#2E5A8F]">
            <Clock className="h-4 w-4" />
            Report History
          </Link>
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
