import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MessageSquareHeart } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import StarRating from '@/components/support/StarRating';
import { SYSTEM_FEEDBACK_SOURCE, createSupportRequest, hasSentSystemFeedback } from '@/services/supportRequestsService';

/**
 * Company admins must rate FirmiCore (1–5 stars) and leave a comment. The
 * modal has no close button and ignores Escape / backdrop clicks, so it can't
 * be skipped; once sent it disappears for good and the feedback lands in the
 * platform console's "Requests & feedback" tab.
 */
export default function MandatoryFeedbackModal() {
  const { t } = useTranslation();
  const company = useAuthStore((s) => s.company);
  const profile = useAuthStore((s) => s.userProfile);
  const [needed, setNeeded] = useState(false);
  const [rating, setRating] = useState<number | null>(null);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const isAdmin = profile?.role === 'admin';
  const companyId = company?.id;
  const uid = profile?.id;

  useEffect(() => {
    if (!isAdmin || !companyId || !uid) return undefined;
    let cancelled = false;
    // On a failed lookup stay hidden rather than nag with a form we can't verify.
    hasSentSystemFeedback(companyId, uid).then((sent) => { if (!cancelled) setNeeded(!sent); }).catch(() => {});
    return () => { cancelled = true; };
  }, [isAdmin, companyId, uid]);

  if (!needed || !company || !profile) return null;

  const canSend = !!rating && comment.trim().length > 0 && !busy;

  async function submit() {
    if (!canSend || !company || !profile) return;
    setBusy(true);
    setError('');
    try {
      await createSupportRequest({
        companyId: company.id, companyName: company.name, uid: profile.id, name: profile.fullName, email: profile.email,
        type: 'feedback', subject: `System feedback · ${rating}/5`, message: comment, rating, source: SYSTEM_FEEDBACK_SOURCE,
      });
      setNeeded(false);
    } catch {
      setError(t('common.feedbackModal.error', { defaultValue: 'Could not send your feedback. Please try again.' }));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-labelledby="feedback-modal-title">
      <div className="w-full max-w-md rounded-2xl border border-[#1E3A5F] bg-[#0F1E35] p-6 shadow-2xl">
        <div className="mb-4 flex items-center gap-3">
          <MessageSquareHeart className="h-6 w-6 text-blue-400" />
          <h2 id="feedback-modal-title" className="text-lg font-bold text-white">
            {t('common.feedbackModal.title', { defaultValue: 'How is FirmiCore working for you?' })}
          </h2>
        </div>
        <p className="mb-4 text-sm text-slate-300">
          {t('common.feedbackModal.subtitle', { defaultValue: 'Please rate the system and tell us what you think. This takes a minute and helps us improve.' })}
        </p>
        <div className="mb-4 flex justify-center">
          <StarRating value={rating} onChange={setRating} size={36} label={(n) => t('common.supportRequests.form.stars', { count: n, defaultValue: `${n}/5` })} />
        </div>
        <textarea
          className="h-28 w-full rounded-lg border border-[#1E3A5F] bg-[#0A1628] px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
          value={comment}
          maxLength={5000}
          onChange={(e) => setComment(e.target.value)}
          placeholder={t('common.feedbackModal.placeholder', { defaultValue: 'Your comments about the system…' })}
        />
        {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
        <button
          type="button"
          disabled={!canSend}
          onClick={() => void submit()}
          className="mt-4 w-full rounded-lg bg-[#1A56DB] px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? t('common.feedbackModal.sending', { defaultValue: 'Sending…' }) : t('common.feedbackModal.send', { defaultValue: 'Send feedback' })}
        </button>
        <p className="mt-2 text-center text-[11px] text-slate-500">
          {t('common.feedbackModal.required', { defaultValue: 'A star rating and a comment are required.' })}
        </p>
      </div>
    </div>
  );
}
