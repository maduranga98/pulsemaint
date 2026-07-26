import type { HandoverHistoryFilters } from '@/types/handover.types';

// The 8 roles this app has (src/types/auth.ts UserRole) — kept as a fixed
// list here rather than derived from live data so the Role select always
// offers every role, even one nobody has clocked a shift under yet.
const ROLE_OPTIONS = ['admin', 'plant_manager', 'supervisor', 'technician', 'store_keeper', 'hr_officer', 'trainee', 'floor_operator'];

interface HandoverFilterBarProps {
  filters: HandoverHistoryFilters;
  onChange: (filters: HandoverHistoryFilters) => void;
  /** Shift plan names that actually exist, for the Shift select. */
  shiftOptions: string[];
  /** Departments that actually exist on a shift plan, for the Department select. */
  departmentOptions: string[];
}

function roleLabel(role: string): string {
  return role.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function HandoverFilterBar({ filters, onChange, shiftOptions, departmentOptions }: HandoverFilterBarProps) {
  return (
    <div className="grid gap-3 rounded-lg border border-slate-200 bg-white p-3 sm:grid-cols-4 lg:grid-cols-7">
      <input type="date" value={filters.dateFrom ?? ''} onChange={(event) => onChange({ ...filters, dateFrom: event.target.value || null })} className="min-h-12 rounded-md border border-slate-200 px-3 text-sm" />
      <input type="date" value={filters.dateTo ?? ''} onChange={(event) => onChange({ ...filters, dateTo: event.target.value || null })} className="min-h-12 rounded-md border border-slate-200 px-3 text-sm" />
      <input
        value={filters.personName}
        onChange={(event) => onChange({ ...filters, personName: event.target.value })}
        placeholder="Search name…"
        className="min-h-12 rounded-md border border-slate-200 px-3 text-sm"
      />
      <select value={filters.role} onChange={(event) => onChange({ ...filters, role: event.target.value })} className="min-h-12 rounded-md border border-slate-200 px-3 text-sm">
        <option value="">All roles</option>
        {ROLE_OPTIONS.map((role) => (
          <option key={role} value={role}>{roleLabel(role)}</option>
        ))}
      </select>
      <select value={filters.shiftName} onChange={(event) => onChange({ ...filters, shiftName: event.target.value })} className="min-h-12 rounded-md border border-slate-200 px-3 text-sm">
        <option value="">All shifts</option>
        {shiftOptions.map((name) => (
          <option key={name} value={name}>{name}</option>
        ))}
      </select>
      <select value={filters.department} onChange={(event) => onChange({ ...filters, department: event.target.value })} className="min-h-12 rounded-md border border-slate-200 px-3 text-sm">
        <option value="">All departments</option>
        {departmentOptions.map((dept) => (
          <option key={dept} value={dept}>{dept}</option>
        ))}
      </select>
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
