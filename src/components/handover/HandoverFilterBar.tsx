import type { HandoverHistoryFilters } from '@/types/handover.types';

interface HandoverFilterBarProps {
  filters: HandoverHistoryFilters;
  onChange: (filters: HandoverHistoryFilters) => void;
}

export function HandoverFilterBar({ filters, onChange }: HandoverFilterBarProps) {
  return (
    <div className="grid gap-3 rounded-lg border border-slate-200 bg-white p-3 sm:grid-cols-6">
      <input type="date" value={filters.dateFrom ?? ''} onChange={(event) => onChange({ ...filters, dateFrom: event.target.value || null })} className="min-h-12 rounded-md border border-slate-200 px-3 text-sm" />
      <input type="date" value={filters.dateTo ?? ''} onChange={(event) => onChange({ ...filters, dateTo: event.target.value || null })} className="min-h-12 rounded-md border border-slate-200 px-3 text-sm" />
      <input value={filters.supervisorName} onChange={(event) => onChange({ ...filters, supervisorName: event.target.value })} placeholder="Supervisor" className="min-h-12 rounded-md border border-slate-200 px-3 text-sm" />
      <input value={filters.shiftName} onChange={(event) => onChange({ ...filters, shiftName: event.target.value })} placeholder="Shift" className="min-h-12 rounded-md border border-slate-200 px-3 text-sm" />
      <input value={filters.department} onChange={(event) => onChange({ ...filters, department: event.target.value })} placeholder="Department" className="min-h-12 rounded-md border border-slate-200 px-3 text-sm" />
      <label className="flex min-h-12 items-center gap-2 rounded-md border border-slate-200 px-3 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={filters.lateOnly}
          onChange={(event) => onChange({ ...filters, lateOnly: event.target.checked })}
          className="h-4 w-4 rounded border-slate-300 text-red-600 focus:ring-red-500"
        />
        Late only
      </label>
    </div>
  );
}

export default HandoverFilterBar;
