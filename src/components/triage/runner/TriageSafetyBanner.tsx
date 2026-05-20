import { useTranslation } from 'react-i18next';
import type { TriageSafetyLevel } from '../../../types/triage';

interface Props {
  level: TriageSafetyLevel;
}

const bannerConfig: Record<TriageSafetyLevel, { bg: string; text: string; key: string }> = {
  danger: { bg: 'bg-red-600', text: 'text-white', key: 'triage.safety_banner.danger' },
  caution: { bg: 'bg-amber-500', text: 'text-white', key: 'triage.safety_banner.caution' },
  safe: { bg: 'bg-green-600', text: 'text-white', key: 'triage.safety_banner.safe' },
};

export default function TriageSafetyBanner({ level }: Props) {
  const { t } = useTranslation();
  const cfg = bannerConfig[level];
  return (
    <div className={`w-full py-2 px-4 text-center text-sm font-semibold ${cfg.bg} ${cfg.text}`}>
      {t(cfg.key)}
    </div>
  );
}
