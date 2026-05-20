import { X } from 'lucide-react';
import type { ShiftConfig } from '@/types/handover.types';
import { formatDuration, formatTimeRange } from '@/utils/handover.utils';

interface EndShiftConfirmModalProps {
  open: boolean;
  shift: ShiftConfig | null;
  shiftStartTime: Date | null;
  onCancel: () => void;
  onConfirm: () => void;
  loading?: boolean;
}

export function EndShiftConfirmModal({ open, shift, shiftStartTime, onCancel, onConfirm, loading = false }: EndShiftConfirmModalProps) {
  if (!open) return null;
  const elapsed = shiftStartTime ? formatDuration(Date.now() - shiftStartTime.getTime()) : 'Not started';

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-slate-950/50 p-4 sm:items-center sm:justify-center">
      <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="font-[Sora] text-lg font-bold text-slate-950">End Shift</h2>
            <p className="mt-1 text-sm text-slate-500">Are you sure you want to end your shift?</p>
          </div>
          <button type="button" onClick={onCancel} className="min-h-12 min-w-12 rounded-md text-slate-500" aria-label="Close">
            <X className="mx-auto h-5 w-5" />
          </button>
        </div>
        <dl className="mt-4 grid gap-3 rounded-lg bg-slate-50 p-4 text-sm">
          <div className="flex justify-between gap-3"><dt className="text-slate-500">Current shift</dt><dd className="font-semibold text-slate-950">{shift?.shiftName ?? 'Current Shift'}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-slate-500">Scheduled</dt><dd>{shift ? formatTimeRange(shift.startTime, shift.endTime) : '-'}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-slate-500">Current time</dt><dd>{new Date().toLocaleTimeString()}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-slate-500">Duration</dt><dd className="font-semibold text-cyan-700">{elapsed}</dd></div>
        </dl>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onCancel} className="min-h-12 rounded-md border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700">Cancel</button>
          <button type="button" onClick={onConfirm} disabled={loading} className="min-h-12 rounded-md bg-amber-500 px-4 py-2 text-sm font-bold text-white disabled:opacity-60">
            {loading ? 'Generating...' : 'End Shift & Generate Report'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default EndShiftConfirmModal;
