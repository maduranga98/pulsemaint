import type { NextShiftPriority, OngoingBreakdownSnapshot } from '@/types/handover.types';
import { severityClass } from '@/utils/handover.utils';

interface BreakdownSnapshotRowProps {
  breakdown: OngoingBreakdownSnapshot;
  onChange?: (updates: Partial<OngoingBreakdownSnapshot>) => void;
  readOnly?: boolean;
}

export function BreakdownSnapshotRow({ breakdown, onChange, readOnly = false }: BreakdownSnapshotRowProps) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-semibold text-slate-950">{breakdown.ticketNumber}</p>
          <p className="text-sm text-slate-600">{breakdown.machineName}</p>
          <p className={`text-xs font-semibold ${severityClass(breakdown.severity)}`}>{breakdown.severity} - {breakdown.currentState}</p>
        </div>
        <span className="text-xs font-semibold text-cyan-700">{breakdown.timeElapsedMinutes} min elapsed</span>
      </div>
      {readOnly ? (
        <p className="mt-3 text-sm text-slate-600">{breakdown.supervisorNote || 'No note'} - {breakdown.nextShiftPriority}</p>
      ) : (
        <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_190px]">
          <input
            value={breakdown.supervisorNote}
            onChange={(event) => onChange?.({ supervisorNote: event.target.value })}
            placeholder="Breakdown note"
            className="min-h-12 rounded-md border border-slate-200 px-3 text-sm"
          />
          <select
            value={breakdown.nextShiftPriority}
            onChange={(event) => onChange?.({ nextShiftPriority: event.target.value as NextShiftPriority })}
            className="min-h-12 rounded-md border border-slate-200 px-3 text-sm"
          >
            <option value="urgent">Urgent - resolve immediately</option>
            <option value="continue">Continue normally</option>
            <option value="monitor">Monitoring only</option>
          </select>
        </div>
      )}
    </div>
  );
}

export default BreakdownSnapshotRow;
