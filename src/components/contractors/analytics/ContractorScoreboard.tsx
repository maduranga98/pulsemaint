import { Link } from 'react-router-dom';
import type { Contractor } from '@/lib/contractors/contractorTypes';
import { formatLkr } from '@/lib/contractors/invoiceCalculator';

interface ContractorScoreboardProps {
  contractors: Contractor[];
}

export function ContractorScoreboard({ contractors }: ContractorScoreboardProps) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3">Rank</th>
            <th className="px-4 py-3">Contractor</th>
            <th className="px-4 py-3">Rating</th>
            <th className="px-4 py-3">Jobs</th>
            <th className="px-4 py-3">MTTR</th>
            <th className="px-4 py-3">SLA</th>
            <th className="px-4 py-3">Invoice</th>
            <th className="px-4 py-3">Last Job</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {contractors.map((contractor, index) => (
            <tr key={contractor.id} className="hover:bg-slate-50">
              <td className="px-4 py-3 font-bold">#{index + 1}</td>
              <td className="px-4 py-3"><Link to={`/app/contractors/${contractor.id}/analytics`} className="font-semibold text-blue-700">{contractor.companyName}</Link></td>
              <td className="px-4 py-3">{contractor.avgRating.toFixed(1)}</td>
              <td className="px-4 py-3">{contractor.totalJobsCount}</td>
              <td className="px-4 py-3">{contractor.avgMttr} min</td>
              <td className="px-4 py-3">{contractor.slaComplianceRate}%</td>
              <td className="px-4 py-3">{contractor.invoiceAccuracyRate}%</td>
              <td className="px-4 py-3">{contractor.lastJobDate ? contractor.lastJobDate.toDate().toLocaleDateString() : '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {!contractors.length && <div className="p-8 text-center text-slate-500">No contractor performance data yet. {formatLkr(0)}</div>}
    </div>
  );
}

export default ContractorScoreboard;
