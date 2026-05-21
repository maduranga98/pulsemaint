import { Search, X } from 'lucide-react';
import {
  CONTRACTOR_SPECIALIZATION_TAGS,
  SPECIALIZATION_LABELS,
  type ContractorFilters,
  type ContractorSpecializationTag,
} from '@/lib/contractors/contractorTypes';

interface ContractorFilterBarProps {
  filters: ContractorFilters;
  onChange: (filters: ContractorFilters) => void;
}

export function ContractorFilterBar({ filters, onChange }: ContractorFilterBarProps) {
  const toggleTag = (tag: ContractorSpecializationTag) => {
    const current = filters.specializationTags ?? [];
    const next = current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag];
    onChange({ ...filters, specializationTags: next });
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="grid gap-3 md:grid-cols-[1fr_160px_150px_140px_auto]">
        <label className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={filters.search ?? ''}
            onChange={(event) => onChange({ ...filters, search: event.target.value })}
            placeholder="Search company, trade name, registration"
            className="h-10 w-full rounded-md border border-slate-200 pl-9 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
        </label>
        <select
          value={filters.status ?? 'all'}
          onChange={(event) => onChange({ ...filters, status: event.target.value as ContractorFilters['status'] })}
          className="h-10 rounded-md border border-slate-200 px-3 text-sm"
        >
          <option value="all">All status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="blacklisted">Blacklisted</option>
        </select>
        <select
          value={filters.minRating ?? 0}
          onChange={(event) => onChange({ ...filters, minRating: Number(event.target.value) || undefined })}
          className="h-10 rounded-md border border-slate-200 px-3 text-sm"
        >
          <option value="0">Any rating</option>
          <option value="4">4 stars+</option>
          <option value="3">3 stars+</option>
        </select>
        <select
          value={filters.documentStatus ?? 'all'}
          onChange={(event) => onChange({ ...filters, documentStatus: event.target.value as ContractorFilters['documentStatus'] })}
          className="h-10 rounded-md border border-slate-200 px-3 text-sm"
        >
          <option value="all">All docs</option>
          <option value="valid">Valid</option>
          <option value="expiring">Expiring</option>
          <option value="expired">Expired</option>
        </select>
        <button type="button" onClick={() => onChange({})} className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-200 px-3 text-sm font-medium text-slate-700">
          <X className="h-4 w-4" />
          Clear
        </button>
      </div>
      <div className="mt-3 flex gap-2 overflow-x-auto">
        {CONTRACTOR_SPECIALIZATION_TAGS.map((tag) => {
          const selected = filters.specializationTags?.includes(tag);
          return (
            <button
              key={tag}
              type="button"
              onClick={() => toggleTag(tag)}
              className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium ${selected ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-600'}`}
            >
              {SPECIALIZATION_LABELS[tag]}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default ContractorFilterBar;
