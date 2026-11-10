import { X } from 'lucide-react';
import { createPortal } from 'react-dom';
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
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end bg-slate-950/70 p-4 sm:items-center sm:justify-center">
      <div className="w-full max-w-md rounded-3xl border border-[#1E3A5F] bg-[#0F1E35] p-6 shadow-2xl">
        <div className="flex items-start justify-between">
          <div>
            <h2 className=" text-lg font-bold text-[#F0F4F8]">{t('common.shiftHandovers.endShiftConfirmModal.title')}</h2>
            <p className="mt-1 text-sm text-[#B8C7DB]">{t('common.shiftHandovers.endShiftConfirmModal.confirmQuestion')}</p>
          </div>
          <button type="button" onClick={onCancel} className="min-h-12 min-w-12 rounded-full text-[#8BA3BF] hover:text-[#F0F4F8]" aria-label={t('common.shiftHandovers.endShiftConfirmModal.closeAria')}>
            <X className="mx-auto h-5 w-5" />
          </button>
        </div>
        <dl className="mt-4 grid gap-3 rounded-2xl border border-[#1E3A5F] bg-[#142849] p-4 text-sm">
          <div className="flex justify-between gap-3"><dt className="text-[#B8C7DB]">{t('common.shiftHandovers.endShiftConfirmModal.currentShift')}</dt><dd className="font-semibold text-[#F0F4F8]">{shift?.shiftName ?? t('common.shiftHandovers.endShiftConfirmModal.currentShiftFallback')}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-[#B8C7DB]">{t('common.shiftHandovers.endShiftConfirmModal.scheduled')}</dt><dd className="text-[#F0F4F8]">{shift ? formatTimeRange(shift.startTime, shift.endTime) : '-'}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-[#B8C7DB]">{t('common.shiftHandovers.endShiftConfirmModal.currentTime')}</dt><dd className="text-[#F0F4F8]">{new Date().toLocaleTimeString()}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-[#B8C7DB]">{t('common.shiftHandovers.endShiftConfirmModal.duration')}</dt><dd className="font-semibold text-[#00C2FF]">{elapsed}</dd></div>
        </dl>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onCancel} className="min-h-12 rounded-full border border-[#1E3A5F] px-4 py-2 text-sm font-semibold text-[#F0F4F8] hover:bg-[#142849]">{t('common.shiftHandovers.endShiftConfirmModal.cancel')}</button>
          <button type="button" onClick={onConfirm} disabled={loading} className="min-h-12 rounded-full bg-amber-500 px-4 py-2 text-sm font-bold text-white disabled:opacity-60">
            {loading
              ? t('common.shiftHandovers.endShiftConfirmModal.generating')
              : canHandover
                ? t('common.shiftHandovers.endShiftConfirmModal.endShiftAndGenerateReport')
                : t('common.shiftHandovers.endShiftConfirmModal.endShift')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default EndShiftConfirmModal;
