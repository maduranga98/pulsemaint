import { X, Clock, TrendingUp } from 'lucide-react';
import type { ShiftSession } from '@/types/handover.types';
import { formatDuration, formatTimeRange } from '@/utils/handover.utils';

interface ShiftSummaryModalProps {
  session: ShiftSession | null;
  canHandover: boolean;
  onClose: () => void;
  onContinueToHandover: () => void;
}

/**
 * Shown after a shift ends: total worked hours, OT, and (for supervisors) the
 * handover step.
 *
 * Dark surface with explicit light text, matching EndShiftConfirmModal — the
 * two are consecutive steps of ending a shift for every role, and the light
 * card this used to be sat wrong against the app's dark theme (and needed
 * per-element black text overrides just to stay readable).
 */
function formatDateTime(d: Date): string {
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

export function ShiftSummaryModal({ session, canHandover, onClose, onContinueToHandover }: ShiftSummaryModalProps) {
  if (!session) return null;
  const totalMinutes = session.totalMinutes ?? 0;
  const otMinutes = session.otMinutes ?? 0;

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-slate-950/70 p-4 sm:items-center sm:justify-center">
      <div className="w-full max-w-md rounded-lg border border-slate-700 bg-slate-900 p-5 shadow-xl">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="font-[Sora] text-lg font-bold text-white">Shift Ended</h2>
            <p className="mt-1 text-sm text-slate-300">{session.shiftName} · {session.shiftDate}</p>
          </div>
          <button type="button" onClick={onClose} className="min-h-12 min-w-12 rounded-md text-slate-400 hover:text-white" aria-label="Close">
            <X className="mx-auto h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 p-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-cyan-300"><Clock className="h-4 w-4" /> Total Hours</div>
            <p className="mt-1 font-[Sora] text-2xl font-bold text-cyan-100">{formatDuration(totalMinutes * 60000)}</p>
          </div>
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-amber-300"><TrendingUp className="h-4 w-4" /> Overtime</div>
            <p className="mt-1 font-[Sora] text-2xl font-bold text-amber-100">{otMinutes > 0 ? formatDuration(otMinutes * 60000) : 'None'}</p>
          </div>
        </div>

        <dl className="mt-3 grid gap-2 rounded-lg border border-slate-700 bg-slate-800 p-4 text-sm">
          <div className="flex justify-between gap-3"><dt className="text-slate-300">Scheduled</dt><dd className="text-slate-100">{formatTimeRange(session.scheduledStart, session.scheduledEnd)} ({formatDuration(session.scheduledMinutes * 60000)})</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-slate-300">Started</dt><dd className="text-slate-100">{formatDateTime(session.actualStart)}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-slate-300">Ended</dt><dd className="text-slate-100">{session.actualEnd ? formatDateTime(session.actualEnd) : '-'}</dd></div>
        </dl>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} className="min-h-12 rounded-md border border-slate-600 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800">Close</button>
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
