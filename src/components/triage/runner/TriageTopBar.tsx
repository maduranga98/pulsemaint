import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { TriageLanguage, TriageSafetyLevel } from '../../../types/triage';
import TriageLanguageSwitcher from '../shared/TriageLanguageSwitcher';
import TriageTimer from './TriageTimer';

interface Props {
  machineName: string;
  language: TriageLanguage;
  onLanguageChange: (lang: TriageLanguage) => void;
  startedAt: number;
  safetyLevel: TriageSafetyLevel;
  onAbandon: () => void;
}

const topBarBg: Record<TriageSafetyLevel, string> = {
  safe: 'bg-[#0A1628]',
  caution: 'bg-amber-700',
  danger: 'bg-red-700',
};

export default function TriageTopBar({
  machineName,
  language,
  onLanguageChange,
  startedAt,
  safetyLevel,
  onAbandon,
}: Props) {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const handleBack = () => {
    if (window.confirm(t('triage.abandon_confirm'))) {
      onAbandon();
      navigate(-1);
    }
  };

  return (
    <div className={`fixed top-0 left-0 right-0 z-50 ${topBarBg[safetyLevel]} px-4 py-3 flex items-center justify-between`}>
      <button
        onClick={handleBack}
        className="text-white/80 hover:text-white flex items-center gap-1 min-h-[44px] px-1"
        aria-label="Back"
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </button>

      <div className="flex-1 mx-3 min-w-0">
        <p className="text-white font-semibold text-[15px] truncate font-['Sora']">{machineName}</p>
      </div>

      <div className="flex items-center gap-3">
        <TriageTimer startedAt={startedAt} />
        <TriageLanguageSwitcher current={language} onChange={onLanguageChange} />
      </div>
    </div>
  );
}
