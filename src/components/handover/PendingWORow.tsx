import type { CarryForwardStatus, PendingWOSnapshot } from '@/types/handover.types';

interface PendingWORowProps {
  wo: PendingWOSnapshot;
  onChange?: (updates: Partial<PendingWOSnapshot>) => void;
  readOnly?: boolean;
}

export function PendingWORow({ wo, onChange, readOnly = false }: PendingWORowProps) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-semibold text-slate-950">{wo.woNumber}</p>
          <p className="text-sm text-slate-600">{wo.machineName} - {wo.woType}</p>
          <p className="text-xs text-slate-500">{wo.priority} - {wo.currentStatus} - {wo.assignedTechnician}</p>
        </div>
        <span className="text-xs font-semibold text-amber-700">{wo.dueDate ? wo.dueDate.toLocaleDateString() : 'No due date'}</span>
      </div>
      {readOnly ? (
        <p className="mt-3 text-sm text-slate-600">{wo.supervisorNote || 'No note'} - {wo.carryForwardStatus}</p>
      ) : (
        <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_180px]">
          <input
            value={wo.supervisorNote}
            onChange={(event) => onChange?.({ supervisorNote: event.target.value })}
            placeholder="Supervisor note"
            className="min-h-12 rounded-md border border-slate-200 px-3 text-sm"
          />
          <select
            value={wo.carryForwardStatus}
            onChange={(event) => onChange?.({ carryForwardStatus: event.target.value as CarryForwardStatus })}
            className="min-h-12 rounded-md border border-slate-200 px-3 text-sm"
          >
            <option value="continue">Continue Next Shift</option>
            <option value="escalate">Escalate to Manager</option>
            <option value="on_hold">On Hold</option>
          </select>
        </div>
      )}
    </div>
  );
}

export default PendingWORow;
