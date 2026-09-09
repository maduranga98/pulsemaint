import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import type { Contractor } from '@/lib/contractors/contractorTypes';
import { useContractorAccess } from '@/hooks/contractors/useContractorAccess';
import { useContractorJobStats } from '@/hooks/contractors/useContractorJobStats';
import ContractorDocStatusDot from './ContractorDocStatusDot';
import ContractorRatingDisplay from './ContractorRatingDisplay';
import ContractorSpecializationTags from './ContractorSpecializationTags';
import ContractorStatusBadge from './ContractorStatusBadge';

interface ContractorListTableProps {
  contractors: Contractor[];
}

function relativeDate(value: Contractor['lastJobDate'], t: TFunction) {
  if (!value) return t('common.contractors.registry.listTable.lastJob.never');
  const date = value.toDate();
  const days = Math.round((Date.now() - date.getTime()) / 86400000);
  if (days <= 0) return t('common.contractors.registry.listTable.lastJob.today');
  if (days === 1) return t('common.contractors.registry.listTable.lastJob.yesterday');
  return t('common.contractors.registry.listTable.lastJob.daysAgo', { count: days });
}

export function ContractorListTable({ contractors }: ContractorListTableProps) {
  const { t } = useTranslation();
  const { canManageContractors } = useContractorAccess();
  // Live figures — the stored counters on the contractor document are only
  // written by syncContractorMetrics, which never runs. See the hook.
  const { stats } = useContractorJobStats();
  if (!contractors.length) {
    return <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">{t('common.contractors.registry.listTable.empty')}</div>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3">{t('common.contractors.registry.listTable.columns.company')}</th>
            <th className="px-4 py-3">{t('common.contractors.registry.listTable.columns.specializations')}</th>
            <th className="px-4 py-3">{t('common.contractors.registry.listTable.columns.status')}</th>
            <th className="px-4 py-3">{t('common.contractors.registry.listTable.columns.rating')}</th>
            <th className="px-4 py-3">{t('common.contractors.registry.listTable.columns.jobs')}</th>
            <th className="px-4 py-3">{t('common.contractors.registry.listTable.columns.lastJob')}</th>
            <th className="px-4 py-3">{t('common.contractors.registry.listTable.columns.documents')}</th>
            <th className="px-4 py-3">{t('common.contractors.registry.listTable.columns.actions')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {contractors.map((contractor) => (
            <tr key={contractor.id} className="hover:bg-slate-50">
              <td className="px-4 py-3">
                <p className="font-semibold text-slate-950">{contractor.tradeName || contractor.companyName}</p>
                <p className="text-xs text-slate-500">{contractor.companyName}</p>
              </td>
              <td className="px-4 py-3 min-w-[220px]">
                <ContractorSpecializationTags tags={contractor.specializationTags} limit={3} />
              </td>
              <td className="px-4 py-3"><ContractorStatusBadge status={contractor.status} size="sm" /></td>
              <td className="px-4 py-3">
                <ContractorRatingDisplay
                  rating={stats[contractor.id]?.ratingCount ? stats[contractor.id].avgRating : contractor.avgRating}
                  count={stats[contractor.id]?.ratingCount ?? contractor.ratingCount}
                />
              </td>
              <td className="px-4 py-3 text-slate-700">
                {stats[contractor.id]?.jobCount ?? contractor.totalJobsCount ?? 0}
              </td>
              <td className="px-4 py-3 text-slate-600">
                {relativeDate(stats[contractor.id]?.lastJobAt ?? contractor.lastJobDate, t)}
              </td>
              <td className="px-4 py-3">
                <ContractorDocStatusDot status={contractor.blocksAssignment ? 'expired' : 'valid'} />
              </td>
              <td className="px-4 py-3">
                <div className="flex gap-2 text-xs font-semibold">
                  <Link to={`/app/contractors/${contractor.id}`} className="text-blue-700">{t('common.contractors.registry.listTable.actions.view')}</Link>
                  {canManageContractors && <Link to={`/app/contractors/${contractor.id}/edit`} className="text-slate-700">{t('common.contractors.registry.listTable.actions.edit')}</Link>}
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
