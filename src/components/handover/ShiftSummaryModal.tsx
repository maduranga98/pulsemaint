import { X, Clock, TrendingUp } from 'lucide-react';
import type { ShiftSession } from '@/types/handover.types';
import { formatDuration, formatTimeRange } from '@/utils/handover.utils';

interface ShiftSummaryModalProps {
  session: ShiftSession | null;
  canHandover: boolean;
  onClose: () => void;
  onContinueToHandover: () => void;
}

/** Shown after a shift ends: total worked hours, OT, and (for supervisors) the handover step. */
export function ShiftSummaryModal({ session, canHandover, onClose, onContinueToHandover }: ShiftSummaryModalProps) {
  if (!session) return null;
  const totalMinutes = session.totalMinutes ?? 0;
  const otMinutes = session.otMinutes ?? 0;

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-slate-950/50 p-4 sm:items-center sm:justify-center">
      <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="font-[Sora] text-lg font-bold text-slate-950">Shift Ended</h2>
            <p className="mt-1 text-sm text-slate-500">{session.shiftName} · {session.shiftDate}</p>
          </div>
          <button type="button" onClick={onClose} className="min-h-12 min-w-12 rounded-md text-slate-500" aria-label="Close">
            <X className="mx-auto h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-lg bg-cyan-50 p-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-cyan-700"><Clock className="h-4 w-4" /> Total Hours</div>
            <p className="mt-1 font-[Sora] text-2xl font-bold text-cyan-900">{formatDuration(totalMinutes * 60000)}</p>
          </div>
          <div className="rounded-lg bg-amber-50 p-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-amber-700"><TrendingUp className="h-4 w-4" /> Overtime</div>
            <p className="mt-1 font-[Sora] text-2xl font-bold text-amber-900">{otMinutes > 0 ? formatDuration(otMinutes * 60000) : 'None'}</p>
          </div>
        </div>

        {/* Explicit black text on both the labels and the values. The muted
            label colour, and the values' inherited colour, both rendered
            light against this light card under the app's dark theme, leaving
            the schedule unreadable. */}
        <dl className="mt-3 grid gap-2 rounded-lg bg-slate-50 p-4 text-sm text-slate-950">
          <div className="flex justify-between gap-3"><dt className="text-slate-950">Scheduled</dt><dd className="text-slate-950">{formatTimeRange(session.scheduledStart, session.scheduledEnd)} ({formatDuration(session.scheduledMinutes * 60000)})</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-slate-950">Started</dt><dd className="text-slate-950">{session.actualStart.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-slate-950">Ended</dt><dd className="text-slate-950">{session.actualEnd ? session.actualEnd.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}</dd></div>
        </dl>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} className="min-h-12 rounded-md border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700">Close</button>
          {canHandover && (
            <button type="button" onClick={onContinueToHandover} className="min-h-12 rounded-md bg-blue-600 px-4 py-2 text-sm font-bold text-white">
              Hand Over to Next Person
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default ShiftSummaryModal;
