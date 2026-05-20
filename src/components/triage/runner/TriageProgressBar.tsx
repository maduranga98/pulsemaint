import { useTranslation } from 'react-i18next';
import type { TriageStepPhase } from '../../../types/triage';
import TriagePhaseBadge from '../shared/TriagePhaseBadge';

interface Props {
  current: number;
  total: number;
  phase: TriageStepPhase;
}

export default function TriageProgressBar({ current, total, phase }: Props) {
  const { t } = useTranslation();
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;

  return (
    <div className="px-4 pt-2 pb-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-medium text-gray-700">
          {t('triage.step_of', { current, total })}
        </span>
        <TriagePhaseBadge phase={phase} />
      </div>
      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-[#1A56DB] rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
