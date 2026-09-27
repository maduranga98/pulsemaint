import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { FileText, X } from 'lucide-react';
import { TERMS_EFFECTIVE_DATE, TERMS_SECTIONS, TERMS_VERSION } from '@/lib/legal/terms';

interface TermsDialogProps {
  onClose: () => void;
  /** Called from the dialog's own "I agree" button, when the caller wants one. */
  onAccept?: () => void;
}

/**
 * Pop-up window with the full Terms of Service (subscription, auto-renewal,
 * cancellation and suspension terms). Rendered in a portal above any other
 * modal — it's opened from inside the add-card window too. Colours are set
 * explicitly because the app shell remaps bg-white in dark mode.
 */
export default function TermsDialog({ onClose, onAccept }: TermsDialogProps) {
  const { t } = useTranslation();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-[70] overflow-y-auto bg-black/70" role="dialog" aria-modal="true" aria-labelledby="terms-title">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="flex max-h-[calc(100dvh-2rem)] w-full max-w-2xl flex-col rounded-2xl border border-[#1E3A5F] bg-[#0F1E35] shadow-2xl">
          <div className="flex items-start justify-between gap-4 border-b border-[#1E3A5F] px-6 pt-5 pb-4">
            <div className="flex items-start gap-3">
              <FileText className="mt-1 h-5 w-5 shrink-0 text-blue-400" />
              <div>
                <h2 id="terms-title" className="text-xl font-bold text-white!">{t('common.legal.terms.title')}</h2>
                <p className="mt-1 text-xs text-slate-400!">
                  {t('common.legal.terms.effective', { date: TERMS_EFFECTIVE_DATE, version: TERMS_VERSION })}
                </p>
              </div>
            </div>
            <button type="button" onClick={onClose} className="-mr-1 rounded p-1 text-slate-300 hover:text-white" aria-label={t('common.legal.terms.close')}>
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="overflow-y-auto px-6 py-5 space-y-5">
            <p className="rounded-lg border border-amber-700/50 bg-amber-900/20 p-3 text-sm text-amber-200!">
              {t('common.legal.terms.summary')}
            </p>
            {TERMS_SECTIONS.map((section) => (
              <section key={section.id} className="space-y-2">
                <h3 className="text-sm font-semibold text-white!">{section.title}</h3>
                {section.paragraphs.map((p, i) => (
                  <p key={i} className="text-sm leading-relaxed text-slate-300!">{p}</p>
                ))}
              </section>
            ))}
          </div>

          <div className="flex justify-end gap-3 border-t border-[#1E3A5F] px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-600 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800"
            >
              {t('common.legal.terms.close')}
            </button>
            {onAccept && (
              <button
                type="button"
                onClick={() => {
                  onAccept();
                  onClose();
                }}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white! hover:bg-blue-500"
              >
                {t('common.legal.terms.agree')}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
