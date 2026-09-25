import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';

export interface CancelReasonResult {
  reason: string;
  category: string | null;
}

interface CancelReasonModalProps {
  open: boolean;
  title?: string;
  description?: string;
  confirmLabel?: string;
  loading?: boolean;
  onClose: () => void;
  onConfirm: (result: CancelReasonResult) => void;
}

const REASON_CATEGORIES = [
  { value: '', label: 'Select a category (optional)…' },
  { value: 'duplicate', label: 'Duplicate ticket' },
  { value: 'reported_in_error', label: 'Reported in error' },
  { value: 'no_longer_needed', label: 'No longer needed' },
  { value: 'resolved_externally', label: 'Resolved externally' },
  { value: 'wrong_machine', label: 'Wrong machine / asset' },
  { value: 'other', label: 'Other' },
];

/**
 * Reusable modal asking for a required cancellation reason plus an optional
 * reason-category. Shared by breakdown and work-order cancel flows.
 */
export function CancelReasonModal({
  open,
  title,
  description,
  confirmLabel,
  loading = false,
  onClose,
  onConfirm,
}: CancelReasonModalProps) {
  const { t } = useTranslation();
  const [reason, setReason] = useState('');
  const [category, setCategory] = useState('');
  const [touched, setTouched] = useState(false);

  if (!open) return null;

  const reasonInvalid = touched && !reason.trim();

  function handleClose() {
    setReason('');
    setCategory('');
    setTouched(false);
    onClose();
  }

  function handleConfirm() {
    if (!reason.trim()) {
      setTouched(true);
      return;
    }
    onConfirm({ reason: reason.trim(), category: category || null });
    setReason('');
    setCategory('');
    setTouched(false);
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto flex items-start sm:items-center justify-center bg-black/40 p-4 py-8">
      <div className="bg-white rounded-xl shadow-lg w-full max-w-md p-6 my-auto">
        <div className="flex items-start justify-between mb-2">
          <h3 className="text-lg font-semibold text-slate-900">{title ?? t('common.ui.cancelReason.title')}</h3>
          <button
            type="button"
            onClick={handleClose}
            disabled={loading}
            className="p-1 rounded-lg hover:bg-slate-100"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>
        <p className="text-sm text-slate-600 mb-4">{description ?? t('common.ui.cancelReason.description')}</p>

        <label className="block text-xs font-medium uppercase tracking-wide text-slate-500 mb-1">
          {t('common.ui.cancelReason.categoryLabel')}
        </label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          disabled={loading}
          className="w-full mb-4 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-red-500 outline-none"
        >
          {REASON_CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {t(`common.ui.cancelReason.categories.${c.value || 'none'}`, { defaultValue: c.label })}
            </option>
          ))}
        </select>

        <label className="block text-xs font-medium uppercase tracking-wide text-slate-500 mb-1">
          {t('common.ui.cancelReason.reasonLabel')} <span className="text-red-500">*</span>
        </label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          onBlur={() => setTouched(true)}
          rows={3}
          placeholder={t('common.ui.cancelReason.placeholder')}
          className={`w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 ${
            reasonInvalid
              ? 'border-red-400 focus:ring-red-500'
              : 'border-slate-200 focus:ring-red-500'
          }`}
        />
        {reasonInvalid && (
          <p className="text-xs text-red-600 mt-1">{t('common.ui.cancelReason.required')}</p>
        )}

        <div className="flex gap-3 mt-4">
          <button
            type="button"
            onClick={handleClose}
            disabled={loading}
            className="flex-1 px-4 py-2 border border-slate-200 bg-white text-slate-700 font-medium rounded-lg hover:bg-slate-50 text-sm"
          >
            {t('common.ui.cancelReason.goBack')}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={loading || !reason.trim()}
            className="flex-1 px-4 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 disabled:opacity-50 text-sm"
          >
            {loading ? t('common.ui.cancelReason.cancelling') : confirmLabel ?? t('common.ui.cancelReason.confirm')}
          </button>
        </div>
      </div>
    </div>
  );
}
