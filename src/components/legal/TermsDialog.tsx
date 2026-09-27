import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Globe, Mail, MapPin, Phone, X } from 'lucide-react';
import { PROVIDER, TERMS_EFFECTIVE_DATE, TERMS_SECTIONS, TERMS_VERSION } from '@/lib/legal/terms';

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
              <img src="/brand/lumora-logo.svg" alt="Lumora Ventures" className="h-10 w-10 shrink-0 rounded-full bg-white p-0.5" />
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
            <div className="rounded-lg border border-[#1E3A5F] bg-[#0A1628] p-3 text-xs text-slate-300! space-y-1.5">
              <p className="font-semibold text-white!">
                {t('common.legal.terms.providedBy')} {PROVIDER.name} · Companies House no. {PROVIDER.companyNumber}
              </p>
              <p className="flex items-start gap-1.5"><MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-400" />UK: {PROVIDER.ukOffice}</p>
              <p className="flex items-start gap-1.5"><MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-400" />Sri Lanka: {PROVIDER.lkOffice}</p>
              <p className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <a href={`mailto:${PROVIDER.email}`} className="inline-flex items-center gap-1.5 text-blue-300! hover:underline"><Mail className="h-3.5 w-3.5" />{PROVIDER.email}</a>
                <a href={`tel:${PROVIDER.phone.replace(/\s/g, '')}`} className="inline-flex items-center gap-1.5 text-blue-300! hover:underline"><Phone className="h-3.5 w-3.5" />{PROVIDER.phone}</a>
                <a href={PROVIDER.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-blue-300! hover:underline"><Globe className="h-3.5 w-3.5" />lumoraventures.com</a>
              </p>
            </div>
            {TERMS_SECTIONS.map((section) => (
              <section key={section.id} className="space-y-2">
                <h3 className="text-sm font-semibold text-white!">{t(`common.legal.termsContent.${section.id}.title`)}</h3>
                {Array.from({ length: section.paragraphs }, (_, i) => (
                  <p key={i} className="text-sm leading-relaxed text-slate-300!">
                    {t(`common.legal.termsContent.${section.id}.p${i + 1}`, PROVIDER)}
                  </p>
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
