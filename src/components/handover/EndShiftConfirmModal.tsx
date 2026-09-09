import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ShiftConfig } from '@/types/handover.types';
import { formatDuration, formatTimeRange } from '@/utils/handover.utils';

interface EndShiftConfirmModalProps {
  open: boolean;
  shift: ShiftConfig | null;
  shiftStartTime: Date | null;
  onCancel: () => void;
  onConfirm: () => void;
  loading?: boolean;
  /** Only supervisors compile/hand over a shift report on end-shift; every other role just ends the shift. */
  canHandover?: boolean;
}

export function EndShiftConfirmModal({ open, shift, shiftStartTime, onCancel, onConfirm, loading = false, canHandover = false }: EndShiftConfirmModalProps) {
  const { t } = useTranslation();
  if (!open) return null;
  const elapsed = shiftStartTime ? formatDuration(Date.now() - shiftStartTime.getTime()) : t('common.shiftHandovers.endShiftConfirmModal.notStarted');

  // Dark surface with explicit light text throughout. The previous white card
  // inherited the app's dark-theme text colour, so the shift details rendered
  // light-on-light and were unreadable for every role.
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-slate-950/70 p-4 sm:items-center sm:justify-center">
      <div className="w-full max-w-md rounded-lg border border-slate-700 bg-slate-900 p-5 shadow-xl">
        <div className="flex items-start justify-between">
          <div>
            <h2 className=" text-lg font-bold text-white">{t('common.shiftHandovers.endShiftConfirmModal.title')}</h2>
            <p className="mt-1 text-sm text-slate-300">{t('common.shiftHandovers.endShiftConfirmModal.confirmQuestion')}</p>
          </div>
          <button type="button" onClick={onCancel} className="min-h-12 min-w-12 rounded-md text-slate-400 hover:text-white" aria-label={t('common.shiftHandovers.endShiftConfirmModal.closeAria')}>
            <X className="mx-auto h-5 w-5" />
          </button>
        </div>
        <dl className="mt-4 grid gap-3 rounded-lg border border-slate-700 bg-slate-800 p-4 text-sm">
          <div className="flex justify-between gap-3"><dt className="text-slate-300">{t('common.shiftHandovers.endShiftConfirmModal.currentShift')}</dt><dd className="font-semibold text-white">{shift?.shiftName ?? t('common.shiftHandovers.endShiftConfirmModal.currentShiftFallback')}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-slate-300">{t('common.shiftHandovers.endShiftConfirmModal.scheduled')}</dt><dd className="text-slate-100">{shift ? formatTimeRange(shift.startTime, shift.endTime) : '-'}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-slate-300">{t('common.shiftHandovers.endShiftConfirmModal.currentTime')}</dt><dd className="text-slate-100">{new Date().toLocaleTimeString()}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-slate-300">{t('common.shiftHandovers.endShiftConfirmModal.duration')}</dt><dd className="font-semibold text-cyan-300">{elapsed}</dd></div>
        </dl>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onCancel} className="min-h-12 rounded-md border border-slate-600 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800">{t('common.shiftHandovers.endShiftConfirmModal.cancel')}</button>
          <button type="button" onClick={onConfirm} disabled={loading} className="min-h-12 rounded-md bg-amber-500 px-4 py-2 text-sm font-bold text-white disabled:opacity-60">
            {loading
              ? t('common.shiftHandovers.endShiftConfirmModal.generating')
              : canHandover
                ? t('common.shiftHandovers.endShiftConfirmModal.endShiftAndGenerateReport')
                : t('common.shiftHandovers.endShiftConfirmModal.endShift')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default EndShiftConfirmModal;
