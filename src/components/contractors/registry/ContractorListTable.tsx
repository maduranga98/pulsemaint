import { Link } from 'react-router-dom';
import type { Contractor } from '@/lib/contractors/contractorTypes';
import ContractorDocStatusDot from './ContractorDocStatusDot';
import ContractorRatingDisplay from './ContractorRatingDisplay';
import ContractorSpecializationTags from './ContractorSpecializationTags';
import ContractorStatusBadge from './ContractorStatusBadge';

interface ContractorListTableProps {
  contractors: Contractor[];
}

function relativeDate(value: Contractor['lastJobDate']) {
  if (!value) return 'Never';
  const date = value.toDate();
  const days = Math.round((Date.now() - date.getTime()) / 86400000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return `${days} days ago`;
}

export function ContractorListTable({ contractors }: ContractorListTableProps) {
  if (!contractors.length) {
    return <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">No contractors registered. Add your first contractor.</div>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3">Company</th>
            <th className="px-4 py-3">Specializations</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Rating</th>
            <th className="px-4 py-3">Jobs</th>
            <th className="px-4 py-3">Last Job</th>
            <th className="px-4 py-3">Documents</th>
            <th className="px-4 py-3">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {contractors.map((contractor) => (
            <tr key={contractor.id} className="hover:bg-slate-50">
              <td className="px-4 py-3">
                <p className="font-semibold text-slate-950">{contractor.companyName}</p>
                <p className="text-xs text-slate-500">{contractor.tradeName || contractor.registrationNumber}</p>
              </td>
              <td className="px-4 py-3 min-w-[220px]">
                <ContractorSpecializationTags tags={contractor.specializationTags} limit={3} />
              </td>
              <td className="px-4 py-3"><ContractorStatusBadge status={contractor.status} size="sm" /></td>
              <td className="px-4 py-3"><ContractorRatingDisplay rating={contractor.avgRating} count={contractor.ratingCount} /></td>
              <td className="px-4 py-3 text-slate-700">{contractor.totalJobsCount}</td>
              <td className="px-4 py-3 text-slate-600">{relativeDate(contractor.lastJobDate)}</td>
              <td className="px-4 py-3">
                <ContractorDocStatusDot status={contractor.blocksAssignment ? 'expired' : 'valid'} />
              </td>
              <td className="px-4 py-3">
                <div className="flex gap-2 text-xs font-semibold">
                  <Link to={`/app/contractors/${contractor.id}`} className="text-blue-700">View</Link>
                  <Link to={`/app/contractors/${contractor.id}/edit`} className="text-slate-700">Edit</Link>
                  <Link to="/app/work-orders" className={contractor.blocksAssignment ? 'pointer-events-none text-slate-400' : 'text-emerald-700'}>Assign</Link>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default ContractorListTable;
