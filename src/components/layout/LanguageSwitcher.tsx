import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGUAGES, setAppLanguage, type AppLanguage } from '@/lib/i18n';

// Available to every role — sits in the top header next to notifications,
// unlike TriageLanguageSwitcher which only covers the 4 languages the
// Triage runner itself supports.
export default function LanguageSwitcher() {
  const { i18n, t } = useTranslation();

  return (
    <select
      value={i18n.language}
      onChange={(e) => setAppLanguage(e.target.value as AppLanguage)}
      aria-label={t('common.language')}
      className="bg-[#142849] border border-[#1E3A5F] text-[#D5DEEA] text-[12px] rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#1A56DB] hover:bg-[#1E3A5F] transition-colors"
    >
      {SUPPORTED_LANGUAGES.map((l) => (
        <option key={l.code} value={l.code}>
          {l.label}
        </option>
      ))}
    </select>
  );
}
