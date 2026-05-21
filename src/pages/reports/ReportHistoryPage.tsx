import { Link, Navigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import ReportHistoryCard from '../../components/reports/history/ReportHistoryCard';
import ReportHistoryFilterBar from '../../components/reports/history/ReportHistoryFilterBar';
import ReportHistoryTable from '../../components/reports/history/ReportHistoryTable';
import StorageUsageIndicator from '../../components/reports/history/StorageUsageIndicator';
import { useAuthStore } from '../../store/authStore';
import { useReportHistory } from '../../hooks/reports/useReportHistory';

export default function ReportHistoryPage() {
  const canAccess = useAuthStore((state) => state.canAccess(['supervisor', 'plant_manager', 'store_keeper', 'hr_officer', 'admin']));
  const { reportHistory, historyLoading, historyFilters, updateHistoryFilters, deleteReportHistory } = useReportHistory();

  if (!canAccess) return <Navigate to="/app/dashboard" replace />;

  return (
    <div className="min-h-screen bg-[#0A1628] p-4 text-[#F0F4F8] sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Link to="/app/reports" className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-[#00C2FF]">
              <ArrowLeft className="h-4 w-4" />
              Back to Reports
            </Link>
            <h1 className="font-[Sora] text-[28px] font-bold">Report History</h1>
            <p className="mt-1 text-sm text-[#8BA3BF]">Download, share, and manage generated report records</p>
          </div>
          <StorageUsageIndicator reports={reportHistory} />
        </header>

        <ReportHistoryFilterBar filters={historyFilters} onChange={updateHistoryFilters} />

        {historyLoading ? (
          <div className="rounded-lg border border-[#1E3A5F] bg-[#0F1E35] p-8 text-center text-sm text-[#8BA3BF]">Loading report history...</div>
        ) : (
          <>
            <ReportHistoryTable reports={reportHistory} onDelete={(id) => void deleteReportHistory(id)} />
            <div className="grid gap-3 lg:hidden">
              {reportHistory.map((report) => (
                <ReportHistoryCard key={report.id} report={report} onDelete={(id) => void deleteReportHistory(id)} />
              ))}
            </div>
            {!reportHistory.length && (
              <div className="rounded-lg border border-[#1E3A5F] bg-[#0F1E35] p-8 text-center text-sm text-[#8BA3BF]">
                No generated reports yet.
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
