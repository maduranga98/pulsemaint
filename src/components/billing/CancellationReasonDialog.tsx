import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle } from 'lucide-react';
import { CANCELLATION_REASONS, type CancellationReason } from '@/lib/cancellation';
import { requestCancellation } from '@/services/billingService';

/**
 * Reason window for cancelling the subscription, leaving FirmiCore, or a
 * cancellation made in the Stripe portal ('reason'). It can't be dismissed
 * by clicking outside or pressing Escape, and nothing is submitted without a
 * reason; for 'reason' there is no way back at all.
 */
export default function CancellationReasonDialog({ kind, endsOn, onBack, onDone }: {
  kind: 'cancel_subscription' | 'leave_system' | 'reason';
  endsOn?: string | null;
  onBack?: () => void;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const [reason, setReason] = useState<CancellationReason | ''>('');
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const needsDetails = reason === 'other' && !details.trim();

  async function submit() {
    if (!reason) {
      setError(t('common.billing.leave.dialog.required'));
      return;
    }
    if (needsDetails) {
      setError(t('common.billing.leave.dialog.detailsRequired'));
      return;
    }
    setBusy(true);
    setError('');
    try {
      await requestCancellation(kind, reason, details.trim());
      onDone();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  const title = kind === 'leave_system' ? t('common.billing.leave.dialog.leaveTitle')
    : kind === 'reason' ? t('common.billing.leave.dialog.pendingTitle') : t('common.billing.leave.dialog.cancelTitle');
  const effect = kind === 'leave_system' ? t('common.billing.leave.dialog.leaveEffect')
    : kind === 'reason' ? t('common.billing.leave.dialog.pendingIntro')
    : endsOn ? t('common.billing.leave.dialog.cancelEffect', { date: endsOn }) : t('common.billing.leave.dialog.cancelEffectNoDate');

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-labelledby="cancel-reason-title">
      <div className="flex max-h-[94vh] w-full max-w-lg flex-col rounded-xl border border-[#1E3A5F] bg-[#0F1E35]">
        <div className="border-b border-[#1E3A5F] px-5 py-4">
          <h2 id="cancel-reason-title" className="flex items-center gap-2 text-lg font-semibold text-white!">
            <AlertTriangle className="h-5 w-5 text-amber-400" /> {title}
          </h2>
          <p className="mt-1 text-sm text-slate-400">{effect}</p>
        </div>
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-5 py-4">
          <p className="text-xs font-medium text-slate-400">{t('common.billing.leave.dialog.required')}</p>
          {CANCELLATION_REASONS.map((r) => (
            <label key={r} className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-sm ${reason === r ? 'border-blue-500 bg-blue-600/20 text-white' : 'border-[#1E3A5F] text-slate-300 hover:bg-[#142849]'}`}>
              <input type="radio" name="cancel-reason" value={r} checked={reason === r} onChange={() => setReason(r)} className="accent-blue-500" />
              {t(`common.billing.leave.reasons.${r}`)}
            </label>
          ))}
          <label className="block pt-2">
            <span className="mb-1 block text-xs font-medium text-slate-400">{t('common.billing.leave.dialog.details')}{reason === 'other' && ' *'}</span>
            <textarea
              className="w-full rounded-lg border border-[#1E3A5F] bg-[#0A1628] px-3 py-2 text-sm text-slate-200 focus:border-blue-500 focus:outline-none"
              rows={3} maxLength={2000} value={details} onChange={(e) => setDetails(e.target.value)}
            />
          </label>
          {error && <p className="text-sm text-red-300">{error}</p>}
        </div>
        <div className="flex flex-wrap justify-end gap-2 border-t border-[#1E3A5F] px-5 py-3">
          {kind !== 'reason' && onBack && (
            <button className="rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800" disabled={busy} onClick={onBack}>
              {kind === 'leave_system' ? t('common.billing.leave.dialog.backLeave') : t('common.billing.leave.dialog.back')}
            </button>
          )}
          <button
            className={`rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 ${kind === 'reason' ? 'bg-blue-600 hover:bg-blue-500' : 'bg-red-600 hover:bg-red-500'}`}
            disabled={busy || !reason || needsDetails}
            onClick={() => void submit()}
          >
            {busy ? t('common.billing.leave.dialog.working')
              : kind === 'leave_system' ? t('common.billing.leave.dialog.confirmLeave')
              : kind === 'reason' ? t('common.billing.leave.dialog.submitReason') : t('common.billing.leave.dialog.confirmCancel')}
          </button>
        </div>
      </div>
    </div>
  );
}
