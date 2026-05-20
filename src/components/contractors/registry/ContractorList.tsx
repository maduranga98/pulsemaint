import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useContractors } from '@/hooks/contractors/useContractors';
import type { ContractorFilters } from '@/lib/contractors/contractorTypes';
import ContractorAlertBanner from './ContractorAlertBanner';
import ContractorCard from './ContractorCard';
import ContractorFilterBar from './ContractorFilterBar';
import ContractorListTable from './ContractorListTable';

export function ContractorList() {
  const [filters, setFilters] = useState<ContractorFilters>({});
  const { contractors, loading, totalCount, activeCount, blockedCount } = useContractors(filters);

  return (
    <div className="space-y-5 p-4 lg:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-950">Contractor Registry</h1>
          <p className="mt-1 text-sm text-slate-500">{totalCount} contractors - {activeCount} active - {blockedCount} blocked</p>
        </div>
        <Link to="/app/contractors/new" className="inline-flex items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white">
          <Plus className="h-4 w-4" />
          Add Contractor
        </Link>
      </div>
      <ContractorAlertBanner blockedCount={blockedCount} />
      <ContractorFilterBar filters={filters} onChange={setFilters} />
      {loading ? (
        <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-slate-500">Loading contractors...</div>
      ) : (
        <>
          <div className="grid gap-3 lg:hidden">
            {contractors.map((contractor) => <ContractorCard key={contractor.id} contractor={contractor} />)}
            {!contractors.length && <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">No contractors registered. Add your first contractor.</div>}
          </div>
          <div className="hidden lg:block"><ContractorListTable contractors={contractors} /></div>
        </>
      )}
    </div>
  );
}

export default ContractorList;
