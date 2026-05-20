import { useEffect, useRef, useState } from 'react';
import { Search, X, ChevronDown } from 'lucide-react';
import type { PartCategory, PartStatus, PartCriticality } from '@/types/inventory';

export interface PartFilters {
  search: string;
  category: PartCategory | '';
  status: PartStatus | '';
  criticality: PartCriticality | '';
  stockStatus: 'in_stock' | 'low_stock' | 'out_of_stock' | '';
}

interface PartFilterBarProps {
  filters: PartFilters;
  onChange: (filters: PartFilters) => void;
}

const CATEGORIES: { value: PartCategory; label: string }[] = [
  { value: 'bearings', label: 'Bearings' },
  { value: 'belts_chains', label: 'Belts & Chains' },
  { value: 'bolts_fasteners', label: 'Bolts & Fasteners' },
  { value: 'electrical', label: 'Electrical' },
  { value: 'filters', label: 'Filters' },
  { value: 'gaskets_seals', label: 'Gaskets & Seals' },
  { value: 'gears_sprockets', label: 'Gears & Sprockets' },
  { value: 'hydraulic', label: 'Hydraulic' },
  { value: 'lubricants_oils', label: 'Lubricants & Oils' },
  { value: 'motors_drives', label: 'Motors & Drives' },
  { value: 'pneumatic', label: 'Pneumatic' },
  { value: 'pumps_valves', label: 'Pumps & Valves' },
  { value: 'safety_equipment', label: 'Safety' },
  { value: 'sensors_instrumentation', label: 'Sensors' },
  { value: 'welding_supplies', label: 'Welding' },
  { value: 'other', label: 'Other' },
];

const STATUSES: { value: PartStatus; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'discontinued', label: 'Discontinued' },
];

const CRITICALITIES: { value: PartCriticality; label: string }[] = [
  { value: 'critical', label: 'Critical' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

const STOCK_STATUSES: { value: 'in_stock' | 'low_stock' | 'out_of_stock'; label: string }[] = [
  { value: 'in_stock', label: 'In Stock' },
  { value: 'low_stock', label: 'Low Stock' },
  { value: 'out_of_stock', label: 'Out of Stock' },
];

function Select<T extends string>({
  value,
  placeholder,
  options,
  onChange,
}: {
  value: T | '';
  placeholder: string;
  options: { value: T; label: string }[];
  onChange: (v: T | '') => void;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T | '')}
        className={`appearance-none border border-gray-300 rounded-lg pl-3 pr-8 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white ${value ? 'text-gray-900 font-medium' : 'text-gray-500'}`}
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
    </div>
  );
}

export function PartFilterBar({ filters, onChange }: PartFilterBarProps) {
  const [localSearch, setLocalSearch] = useState(filters.search);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setLocalSearch(filters.search);
  }, [filters.search]);

  function handleSearchChange(val: string) {
    setLocalSearch(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onChange({ ...filters, search: val });
    }, 300);
  }

  function update(patch: Partial<PartFilters>) {
    onChange({ ...filters, ...patch });
  }

  const isFiltered =
    filters.search !== '' ||
    filters.category !== '' ||
    filters.status !== '' ||
    filters.criticality !== '' ||
    filters.stockStatus !== '';

  function clearAll() {
    setLocalSearch('');
    onChange({ search: '', category: '', status: '', criticality: '', stockStatus: '' });
  }

  return (
    <div className="flex flex-wrap gap-2 items-center">
      {/* Search */}
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={localSearch}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder="Search parts…"
          className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <Select
        value={filters.category}
        placeholder="All Categories"
        options={CATEGORIES}
        onChange={(v) => update({ category: v })}
      />

      <Select
        value={filters.status}
        placeholder="All Statuses"
        options={STATUSES}
        onChange={(v) => update({ status: v })}
      />

      <Select
        value={filters.criticality}
        placeholder="Criticality"
        options={CRITICALITIES}
        onChange={(v) => update({ criticality: v })}
      />

      <Select
        value={filters.stockStatus}
        placeholder="Stock Status"
        options={STOCK_STATUSES}
        onChange={(v) => update({ stockStatus: v })}
      />

      {isFiltered && (
        <button
          onClick={clearAll}
          className="inline-flex items-center gap-1 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 border border-gray-200 hover:border-gray-300 rounded-lg transition-colors"
        >
          <X className="w-3.5 h-3.5" />
          Clear
        </button>
      )}
    </div>
  );
}
