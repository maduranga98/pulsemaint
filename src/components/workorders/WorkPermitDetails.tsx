import { ShieldCheck } from 'lucide-react';
import {
  WORK_PERMIT_CATEGORIES,
  WORK_PERMIT_COMPLETIONS,
  formatPermitDateTime,
  isWorkPermitOverdue,
  type WorkPermit,
} from '../../types/safety';

function categoryLabel(value: WorkPermit['category']): string {
  return WORK_PERMIT_CATEGORIES.find((c) => c.value === value)?.label ?? value;
}

function completionLabel(value: WorkPermit['completion']): string | null {
  if (!value) return null;
  return WORK_PERMIT_COMPLETIONS.find((c) => c.value === value)?.label ?? value;
}

function formatTimestamp(ts: WorkPermit['signedOffAt']): string {
  const d = (ts as { toDate?: () => Date } | null | undefined)?.toDate?.();
  if (!d) return '—';
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const STATUS_STYLES_LIGHT: Record<WorkPermit['status'], string> = {
  active: 'bg-emerald-100 text-emerald-700',
  draft: 'bg-gray-100 text-gray-600',
  closed: 'bg-slate-100 text-slate-600',
  expired: 'bg-red-100 text-red-700',
};

const STATUS_STYLES_DARK: Record<WorkPermit['status'], string> = {
  active: 'bg-emerald-500/15 text-emerald-400',
  draft: 'bg-slate-500/15 text-slate-300',
  closed: 'bg-slate-500/15 text-slate-300',
  expired: 'bg-red-500/15 text-red-300',
};

interface Row {
  label: string;
  value: string | null | undefined;
  pre?: boolean;
}

/**
 * The full detail of a Work Permit (Permit-to-Work), rendered as a labelled
 * field list. Shown wherever a work order's linked permit is surfaced — the WO
 * detail panel and the technician start/execution sheet — so approvers and
 * technicians see the same complete permit at a glance.
 *
 * `variant` matches the surrounding surface: 'light' for the manager WO panel,
 * 'dark' for the technician sheet's navy theme.
 */
export function WorkPermitDetails({
  permit,
  variant = 'light',
}: {
  permit: WorkPermit;
  variant?: 'light' | 'dark';
}) {
  const dark = variant === 'dark';
  const overdue = isWorkPermitOverdue(permit);

  const rows: Row[] = [
    { label: 'Category', value: categoryLabel(permit.category) },
    { label: 'Title', value: permit.title },
    { label: 'Description', value: permit.description, pre: true },
    { label: 'Location', value: permit.location },
    { label: 'Valid from', value: formatPermitDateTime(permit.validFrom) },
    { label: 'Valid to', value: formatPermitDateTime(permit.validTo) },
    { label: 'Hazards', value: permit.hazards, pre: true },
    { label: 'PPE required', value: permit.ppeRequired, pre: true },
    { label: 'Requested by', value: permit.requestedByName },
    { label: 'Supervisor', value: permit.supervisorName },
    { label: 'Linked WO', value: permit.workOrderNumber },
    { label: 'Completion', value: completionLabel(permit.completion) },
    { label: 'Completion note', value: permit.completionNote, pre: true },
    { label: 'Signed off by', value: permit.signedOffByName },
    {
      label: 'Signed off at',
      value: permit.signedOffAt ? formatTimestamp(permit.signedOffAt) : null,
    },
  ];

  const labelClass = dark ? 'text-[#8BA3BF]' : 'text-gray-500';
  const valueClass = dark ? 'text-[#F0F4F8]' : 'text-gray-800';
  const statusStyles = dark ? STATUS_STYLES_DARK : STATUS_STYLES_LIGHT;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <ShieldCheck className={`h-4 w-4 ${dark ? 'text-emerald-400' : 'text-emerald-600'}`} />
        <span className={`text-sm font-semibold ${valueClass}`}>
          {permit.permitNumber || 'Work Permit'}
        </span>
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusStyles[permit.status]}`}
        >
          {permit.status}
        </span>
        {overdue && (
          <span className="inline-flex items-center rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">
            Overdue
          </span>
        )}
      </div>

      <div className="space-y-1.5 text-sm">
        {rows
          .filter((r) => r.value != null && String(r.value).trim() !== '')
          .map((r) => (
            <div key={r.label} className="flex items-start gap-2">
              <span className={`w-32 flex-shrink-0 ${labelClass}`}>{r.label}:</span>
              <span className={`${valueClass} ${r.pre ? 'whitespace-pre-line' : ''}`}>{r.value}</span>
            </div>
          ))}

        {permit.precautions.length > 0 && (
          <div className="flex items-start gap-2">
            <span className={`w-32 flex-shrink-0 ${labelClass}`}>Precautions:</span>
            <ul className={`list-disc space-y-0.5 pl-4 ${valueClass}`}>
              {permit.precautions.map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
