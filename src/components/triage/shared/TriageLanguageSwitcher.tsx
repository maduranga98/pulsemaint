import { useTranslation } from 'react-i18next';
import type { TriageLanguage } from '../../../types/triage';

interface Props {
  current: TriageLanguage;
  onChange: (lang: TriageLanguage) => void;
}

const LANGS: { code: TriageLanguage; label: string }[] = [
  { code: 'en', label: 'EN' },
  { code: 'si', label: 'සිං' },
  { code: 'ta', label: 'தமி' },
  { code: 'bn', label: 'বাং' },
];

export default function TriageLanguageSwitcher({ current, onChange }: Props) {
  const { i18n } = useTranslation();

  const handleChange = (lang: TriageLanguage) => {
    onChange(lang);
    void i18n.changeLanguage(lang);
  };

  return (
    <div className="flex gap-1">
      {LANGS.map((l) => (
        <button
          key={l.code}
          onClick={() => handleChange(l.code)}
          className={`px-2 py-1 text-xs rounded font-medium transition-colors ${
            current === l.code
              ? 'bg-[#1A56DB] text-white'
              : 'bg-white/20 text-white hover:bg-white/30'
          }`}
        >
          {l.label}
        </button>
      ))}
    </div>
  );
}
