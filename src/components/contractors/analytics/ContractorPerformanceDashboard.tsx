import { useTranslation } from 'react-i18next';
import { useContractorPerformance } from '@/hooks/contractors/useContractorPerformance';
import ContractorComparisonChart from './ContractorComparisonChart';
import ContractorScoreboard from './ContractorScoreboard';

export function ContractorPerformanceDashboard() {
  const { t } = useTranslation();
  const { contractors, summary, loading } = useContractorPerformance();

  if (loading) return <div className="p-6 text-slate-500">{t('common.contractors.analytics.performanceDashboard.loading')}</div>;

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">{t('common.contractors.analytics.performanceDashboard.stats.activeContractors')}</p><p className="text-2xl font-bold">{summary.totalActiveContractors}</p></div>
        <div className="rounded-lg border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">{t('common.contractors.analytics.performanceDashboard.stats.jobsThisMonth')}</p><p className="text-2xl font-bold">{summary.totalJobsThisMonth}</p></div>
        <div className="rounded-lg border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">{t('common.contractors.analytics.performanceDashboard.stats.avgRating')}</p><p className="text-2xl font-bold">{summary.avgRating}</p></div>
        <div className="rounded-lg border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">{t('common.contractors.analytics.performanceDashboard.stats.slaCompliance')}</p><p className="text-2xl font-bold">{summary.slaComplianceRate}%</p></div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4"><p className="text-sm text-emerald-700">{t('common.contractors.analytics.performanceDashboard.topPerformer')}</p><p className="text-xl font-bold text-emerald-950">{summary.topPerformer?.companyName ?? '-'}</p></div>
        <div className="rounded-lg border border-red-200 bg-red-50 p-4"><p className="text-sm text-red-700">{t('common.contractors.analytics.performanceDashboard.needsReview')}</p><p className="text-xl font-bold text-red-950">{summary.worstPerformer?.companyName ?? '-'}</p></div>
      </div>
      <ContractorScoreboard contractors={contractors} />
      <div className="grid gap-4 xl:grid-cols-3">
        <ContractorComparisonChart contractors={contractors} metric="totalJobsCount" title={t('common.contractors.analytics.performanceDashboard.charts.jobsByContractor')} />
        <ContractorComparisonChart contractors={contractors} metric="avgRating" title={t('common.contractors.analytics.performanceDashboard.charts.avgRatingComparison')} />
        <ContractorComparisonChart contractors={contractors} metric="avgJobCost" title={t('common.contractors.analytics.performanceDashboard.charts.totalCostByContractor')} />
      </div>
    </div>
  );
}

export default ContractorPerformanceDashboard;
