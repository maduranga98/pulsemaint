import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import type { Contractor } from '@/lib/contractors/contractorTypes';
import { formatLkr } from '@/lib/contractors/invoiceCalculator';

interface ContractorScoreboardProps {
  contractors: Contractor[];
}

export function ContractorScoreboard({ contractors }: ContractorScoreboardProps) {
  const { t } = useTranslation();
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3">{t('common.contractors.analytics.scoreboard.columns.rank')}</th>
            <th className="px-4 py-3">{t('common.contractors.analytics.scoreboard.columns.contractor')}</th>
            <th className="px-4 py-3">{t('common.contractors.analytics.scoreboard.columns.rating')}</th>
            <th className="px-4 py-3">{t('common.contractors.analytics.scoreboard.columns.jobs')}</th>
            <th className="px-4 py-3">{t('common.contractors.analytics.scoreboard.columns.mttr')}</th>
            <th className="px-4 py-3">{t('common.contractors.analytics.scoreboard.columns.sla')}</th>
            <th className="px-4 py-3">{t('common.contractors.analytics.scoreboard.columns.invoice')}</th>
            <th className="px-4 py-3">{t('common.contractors.analytics.scoreboard.columns.lastJob')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {contractors.map((contractor, index) => (
            <tr key={contractor.id} className="hover:bg-slate-50">
              <td className="px-4 py-3 font-bold">#{index + 1}</td>
              <td className="px-4 py-3"><Link to={`/app/contractors/${contractor.id}/analytics`} className="font-semibold text-blue-700">{contractor.companyName}</Link></td>
              <td className="px-4 py-3">{contractor.avgRating.toFixed(1)}</td>
              <td className="px-4 py-3">{contractor.totalJobsCount}</td>
              <td className="px-4 py-3">{t('common.contractors.analytics.scoreboard.minutes', { count: contractor.avgMttr })}</td>
              <td className="px-4 py-3">{contractor.slaComplianceRate}%</td>
              <td className="px-4 py-3">{contractor.invoiceAccuracyRate}%</td>
              <td className="px-4 py-3">{contractor.lastJobDate ? contractor.lastJobDate.toDate().toLocaleDateString() : '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {!contractors.length && (
        <div className="p-8 text-center text-slate-500">
          {t('common.contractors.analytics.scoreboard.empty', { amount: formatLkr(0) })}
        </div>
      )}
    </div>
  );
}

export default ContractorScoreboard;
