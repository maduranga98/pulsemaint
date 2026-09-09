import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useContractors } from '@/hooks/contractors/useContractors';
import { useContractorAccess } from '@/hooks/contractors/useContractorAccess';
import type { ContractorFilters } from '@/lib/contractors/contractorTypes';
import ContractorAlertBanner from './ContractorAlertBanner';
import ContractorCard from './ContractorCard';
import ContractorFilterBar from './ContractorFilterBar';
import ContractorListTable from './ContractorListTable';

export function ContractorList() {
  const { t } = useTranslation();
  const [filters, setFilters] = useState<ContractorFilters>({});
  const { contractors, loading, totalCount, activeCount, blockedCount } = useContractors(filters);
  const { canManageContractors } = useContractorAccess();

  return (
    <div className="space-y-5 p-4 lg:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-950">{t('common.contractors.registry.list.title')}</h1>
          <p className="mt-1 text-sm text-slate-500">{t('common.contractors.registry.list.summary', { totalCount, activeCount, blockedCount })}</p>
        </div>
        {canManageContractors && (
          <Link to="/app/contractors/new" className="inline-flex items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white">
            <Plus className="h-4 w-4" />
            {t('common.contractors.registry.list.actions.addContractor')}
          </Link>
        )}
      </div>
      <ContractorAlertBanner blockedCount={blockedCount} />
      <ContractorFilterBar filters={filters} onChange={setFilters} />
      {loading ? (
        <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-slate-500">{t('common.contractors.registry.list.loading')}</div>
      ) : (
        <>
          <div className="grid gap-3 lg:hidden">
            {contractors.map((contractor) => <ContractorCard key={contractor.id} contractor={contractor} />)}
            {!contractors.length && <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">{t('common.contractors.registry.list.empty')}</div>}
          </div>
          <div className="hidden lg:block"><ContractorListTable contractors={contractors} /></div>
        </>
      )}
    </div>
  );
}

export default ContractorList;
