import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Download, PlusSquare, Share, X } from 'lucide-react';
import { useInstallStore } from '@/store/installStore';
import { installMode } from '@/lib/pwa/installMode';

/**
 * "Install app": puts FirmiCore on the phone's home screen / the computer's
 * desktop as its own window (PWA). Shown only where the browser can install
 * and the app is not installed yet; iPhone / iPad get the Share-menu steps.
 */
export default function InstallAppButton({ className = '' }: { className?: string }) {
  const { t } = useTranslation();
  const hasPrompt = useInstallStore((s) => s.promptEvent !== null);
  const standalone = useInstallStore((s) => s.standalone);
  const install = useInstallStore((s) => s.install);
  const [showSteps, setShowSteps] = useState(false);

  const mode = installMode({
    standalone,
    hasPrompt,
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    maxTouchPoints: navigator.maxTouchPoints,
  });
  if (mode === 'hidden') return null;

  const label = t('common.installApp.button');

  return (
    <>
      <button
        type="button"
        data-install-app={mode}
        onClick={() => (mode === 'prompt' ? void install() : setShowSteps(true))}
        aria-label={label}
        title={t('common.installApp.hint')}
        className={`flex h-9 shrink-0 items-center gap-1.5 rounded-md border border-[#1E3A5F] bg-[#142849] px-2.5 text-[12px] font-semibold text-[#D5DEEA] transition-colors hover:bg-[#1E3A5F] focus:outline-none focus-visible:ring-1 focus-visible:ring-[#1A56DB] ${className}`}
      >
        <Download className="h-4 w-4" aria-hidden="true" />
        <span className="hidden lg:inline">{label}</span>
      </button>

      {showSteps &&
        createPortal(
          <div
            className="fixed inset-0 z-[1000] flex items-end justify-center bg-black/60 p-4 sm:items-center"
            role="dialog"
            aria-modal="true"
            aria-label={t('common.installApp.iosTitle')}
            onClick={() => setShowSteps(false)}
          >
            <div
              className="w-full max-w-sm rounded-xl border border-[#1E3A5F] bg-[#0F1E35] p-5 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <img src="/apple-touch-icon.png" alt="" className="h-10 w-10 rounded-lg" />
                  <h2 className="text-[15px] font-semibold text-[#F0F4F8]">
                    {t('common.installApp.iosTitle')}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setShowSteps(false)}
                  aria-label={t('common.installApp.close')}
                  className="rounded-md p-1 text-[#8BA3BF] hover:bg-[#1E3A5F] hover:text-[#F0F4F8]"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
              <ol className="space-y-3 text-[13px] text-[#D5DEEA]">
                <li className="flex items-start gap-3">
                  <Share className="mt-0.5 h-4 w-4 shrink-0 text-[#60A5FA]" aria-hidden="true" />
                  <span>{t('common.installApp.iosStep1')}</span>
                </li>
                <li className="flex items-start gap-3">
                  <PlusSquare className="mt-0.5 h-4 w-4 shrink-0 text-[#60A5FA]" aria-hidden="true" />
                  <span>{t('common.installApp.iosStep2')}</span>
                </li>
                <li className="flex items-start gap-3">
                  <Download className="mt-0.5 h-4 w-4 shrink-0 text-[#60A5FA]" aria-hidden="true" />
                  <span>{t('common.installApp.iosStep3')}</span>
                </li>
              </ol>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
