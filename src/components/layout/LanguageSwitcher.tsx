import { ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGUAGES, setAppLanguage, type AppLanguage } from '@/lib/i18n';

// Available to every role — sits in the top header next to notifications,
// unlike TriageLanguageSwitcher which only covers the 4 languages the
// Triage runner itself supports.
//
// The header shows only the two-letter code of the selected language ("EN",
// "TA"…) so it stays narrow on phones; the native <select> sits invisibly on
// top, so tapping it still opens the system picker with the full language names.
export default function LanguageSwitcher() {
  const { i18n, t } = useTranslation();
  const current = SUPPORTED_LANGUAGES.find((l) => l.code === i18n.language);
  const short = current?.short ?? i18n.language.slice(0, 2).toUpperCase();

  return (
    <div
      data-tour="language"
      className="relative flex min-h-9 items-center gap-1 rounded-md border border-[#1E3A5F] bg-[#142849] px-2.5 text-[12px] font-semibold text-[#D5DEEA] transition-colors hover:bg-[#1E3A5F] focus-within:ring-1 focus-within:ring-[#1A56DB]"
    >
      <span aria-hidden="true">{short}</span>
      <ChevronDown className="h-3 w-3 text-[#8BA3BF]" aria-hidden="true" />
      <select
        value={current?.code ?? i18n.language}
        onChange={(e) => setAppLanguage(e.target.value as AppLanguage)}
        aria-label={t('common.language')}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
      >
        {SUPPORTED_LANGUAGES.map((l) => (
          <option key={l.code} value={l.code}>
            {l.label}
          </option>
        ))}
      </select>
    </div>
  );
}
