import { useMemo, useState } from 'react';
import { AlertTriangle, Search } from 'lucide-react';
import { useContractors } from '@/hooks/contractors/useContractors';
import type { Contractor, ContractorSpecializationTag } from '@/lib/contractors/contractorTypes';
import ContractorRatingDisplay from '@/components/contractors/registry/ContractorRatingDisplay';
import ContractorSpecializationTags from '@/components/contractors/registry/ContractorSpecializationTags';

interface ContractorSearchDropdownProps {
  specialization?: ContractorSpecializationTag;
  onSelect: (contractor: Contractor | null, manualName?: string) => void;
}

export function ContractorSearchDropdown({ specialization, onSelect }: ContractorSearchDropdownProps) {
  const [search, setSearch] = useState('');
  const [manual, setManual] = useState(false);
  const { contractors } = useContractors({ search, specializationTags: specialization ? [specialization] : undefined, status: 'active' });

  const sorted = useMemo(() => [...contractors].sort((a, b) => b.avgRating - a.avgRating), [contractors]);

  if (manual) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
        <label className="text-sm font-semibold text-amber-950">Contractor company name</label>
        <input
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            onSelect(null, event.target.value);
          }}
          className="mt-2 h-10 w-full rounded-md border border-amber-200 px-3 text-sm"
          placeholder="Type contractor name manually"
        />
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <label className="relative block">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search contractors" className="h-10 w-full rounded-md border border-slate-200 pl-9 pr-3 text-sm" />
      </label>
      <div className="mt-3 max-h-80 space-y-2 overflow-y-auto">
        {sorted.map((contractor) => (
          <button
            key={contractor.id}
            type="button"
            disabled={contractor.blocksAssignment}
            onClick={() => onSelect(contractor)}
            title={contractor.blocksAssignment ? 'Critical compliance document expired. Renew to enable assignment.' : undefined}
            className={`w-full rounded-md border p-3 text-left ${contractor.blocksAssignment ? 'cursor-not-allowed border-red-200 bg-red-50 opacity-70' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-slate-950">{contractor.companyName}</p>
                <div className="mt-2"><ContractorSpecializationTags tags={contractor.specializationTags} limit={3} /></div>
              </div>
              {contractor.blocksAssignment ? <AlertTriangle className="h-4 w-4 text-red-600" /> : <ContractorRatingDisplay rating={contractor.avgRating} compact />}
            </div>
            <p className="mt-2 text-xs text-slate-500">Last job: {contractor.lastJobDate ? contractor.lastJobDate.toDate().toLocaleDateString() : 'Never'}</p>
          </button>
        ))}
      </div>
      <button type="button" onClick={() => setManual(true)} className="mt-3 text-sm font-semibold text-amber-700">
        Contractor not registered? Type contractor name manually
      </button>
    </div>
  );
}

export default ContractorSearchDropdown;
