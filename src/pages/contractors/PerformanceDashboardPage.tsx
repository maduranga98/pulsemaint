import ContractorPerformanceDashboard from '@/components/contractors/analytics/ContractorPerformanceDashboard';

export function PerformanceDashboardPage() {
  return (
    <div className="space-y-5 p-4 lg:p-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-950">Contractor Performance</h1>
        <p className="mt-1 text-sm text-slate-500">Scorecards, SLA trends, ratings, costs, and invoice accuracy.</p>
      </div>
      <ContractorPerformanceDashboard />
    </div>
  );
}

export default PerformanceDashboardPage;
