import { useState } from 'react';
import type { PMFilters, PMType, PMStatus } from '../../types/pm.types';
import { PM_TYPE_CONFIG, PM_TYPES_ORDERED, PM_STATUS_CONFIG } from '../../constants/pmConfig';

interface PMFilterBarProps {
  filters: PMFilters;
  onChange: (filters: PMFilters) => void;
  machines: { id: string; name: string }[];
  technicians: { id: string; name: string }[];
}

export function PMFilterBar({ filters, onChange, machines, technicians }: PMFilterBarProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleClear = () => {
    onChange({
      searchQuery: '',
      machineId: undefined,
      pmType: undefined,
      technicianId: undefined,
      status: undefined,
      priority: undefined,
      dateFrom: undefined,
      dateTo: undefined,
    });
  };

  const hasFilters =
    filters.searchQuery ||
    filters.machineId ||
    filters.pmType?.length ||
    filters.technicianId ||
    filters.status?.length ||
    filters.priority?.length ||
    filters.dateFrom ||
    filters.dateTo;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-3 space-y-3">
      <div className="flex gap-2 flex-wrap">
        <div className="flex-1 min-w-[200px]">
          <input
            type="text"
            value={filters.searchQuery || ''}
            onChange={(e) => onChange({ ...filters, searchQuery: e.target.value })}
            placeholder="Search schedules..."
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>

        <select
          value={filters.machineId || ''}
          onChange={(e) => onChange({ ...filters, machineId: e.target.value || undefined })}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
        >
          <option value="">All Machines</option>
          {machines.map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>

        <select
          value={filters.technicianId || ''}
          onChange={(e) => onChange({ ...filters, technicianId: e.target.value || undefined })}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
        >
          <option value="">All Technicians</option>
          {technicians.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>

        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg"
        >
          {isExpanded ? 'Less' : 'More'}
        </button>

        {hasFilters && (
          <button
            onClick={handleClear}
            className="px-3 py-2 text-sm text-red-600 hover:text-red-800 border border-red-200 rounded-lg"
          >
            Clear
          </button>
        )}
      </div>

      {isExpanded && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-gray-100">
          <div>
            <label className="block text-xs text-gray-500 mb-1">PM Type</label>
            <select
              multiple
              value={filters.pmType || []}
              onChange={(e) => {
                const options = Array.from(e.target.selectedOptions).map((o) => o.value as PMType);
                onChange({ ...filters, pmType: options.length ? options : undefined });
              }}
              className="w-full rounded-lg border border-gray-300 px-2 py-1 text-xs focus:ring-2 focus:ring-blue-500 outline-none bg-white"
              size={4}
            >
              {PM_TYPES_ORDERED.map((type) => (
                <option key={type} value={type}>{PM_TYPE_CONFIG[type].label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Status</label>
            <select
              multiple
              value={filters.status || []}
              onChange={(e) => {
                const options = Array.from(e.target.selectedOptions).map((o) => o.value as PMStatus);
                onChange({ ...filters, status: options.length ? options : undefined });
              }}
              className="w-full rounded-lg border border-gray-300 px-2 py-1 text-xs focus:ring-2 focus:ring-blue-500 outline-none bg-white"
              size={4}
            >
              {(['active', 'paused', 'completed', 'archived'] as PMStatus[]).map((s) => (
                <option key={s} value={s}>{PM_STATUS_CONFIG[s].label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Date From</label>
            <input
              type="date"
              value={filters.dateFrom ? filters.dateFrom.toISOString().split('T')[0] : ''}
              onChange={(e) => onChange({ ...filters, dateFrom: e.target.value ? new Date(e.target.value) : undefined })}
              className="w-full rounded-lg border border-gray-300 px-2 py-1 text-xs focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Date To</label>
            <input
              type="date"
              value={filters.dateTo ? filters.dateTo.toISOString().split('T')[0] : ''}
              onChange={(e) => onChange({ ...filters, dateTo: e.target.value ? new Date(e.target.value) : undefined })}
              className="w-full rounded-lg border border-gray-300 px-2 py-1 text-xs focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
        </div>
      )}
    </div>
  );
}
