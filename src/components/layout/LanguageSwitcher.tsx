import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGUAGES, setAppLanguage, type AppLanguage } from '@/lib/i18n';

// Available to every role — sits in the top header next to notifications,
// unlike TriageLanguageSwitcher which only covers the 4 languages the
// Triage runner itself supports.
//
// The header shows only the two-letter code of the selected language ("EN",
// "TA"…) so it stays narrow on phones; opening it lists the full language
// names in a dark menu (a native <select> popup is drawn by the browser and
// can't be themed, so this is a small custom listbox).
export default function LanguageSwitcher() {
  const { i18n, t } = useTranslation();
  const [open, setOpen] = useState(false);
  // Fixed, anchored under the button: the header's action group scrolls
  // horizontally and would clip an absolutely positioned menu.
  const [pos, setPos] = useState<{ top: number; right: number }>({ top: 56, right: 8 });
  const rootRef = useRef<HTMLDivElement>(null);
  const current = SUPPORTED_LANGUAGES.find((l) => l.code === i18n.language);
  const short = current?.short ?? i18n.language.slice(0, 2).toUpperCase();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} data-tour="language" className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t('common.language')}
        onClick={() => {
          const r = rootRef.current?.getBoundingClientRect();
          if (r) setPos({ top: r.bottom + 6, right: Math.max(8, window.innerWidth - r.right) });
          setOpen((o) => !o);
        }}
        className="flex min-h-9 items-center gap-1 rounded-md border border-[#1E3A5F] bg-[#142849] px-2.5 text-[12px] font-semibold text-[#D5DEEA] transition-colors hover:bg-[#1E3A5F] focus:outline-none focus-visible:ring-1 focus-visible:ring-[#1A56DB]"
      >
        <span aria-hidden="true">{short}</span>
        <ChevronDown className={`h-3 w-3 text-[#8BA3BF] transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label={t('common.language')}
          className="fixed z-50 max-h-[70dvh] w-56 overflow-y-auto rounded-xl border border-[#1E3A5F] bg-[#0F1E35] p-1.5 shadow-2xl shadow-black/50 scrollbar-hide"
          style={{ colorScheme: 'dark', top: pos.top, right: pos.right }}
        >
          {SUPPORTED_LANGUAGES.map((l) => {
            const active = l.code === (current?.code ?? i18n.language);
            return (
              <button
                key={l.code}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => {
                  setAppLanguage(l.code as AppLanguage);
                  setOpen(false);
                }}
                className={`flex min-h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-[13px] transition-colors ${
                  active ? 'bg-[#16264A] font-semibold text-white' : 'font-medium text-white hover:bg-[#142849]'
                }`}
              >
                <span className="w-7 shrink-0 text-[11px] font-semibold text-[#8BA3BF]">{l.short}</span>
                <span className="flex-1 truncate">{l.label}</span>
                {active && <Check className="h-3.5 w-3.5 shrink-0 text-[#60A5FA]" aria-hidden="true" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
