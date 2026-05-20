import { useTranslation } from 'react-i18next';
import type { TriageStepPhase } from '../../../types/triage';
import TriagePhaseIcon from './TriagePhaseIcon';

interface Props {
  phase: TriageStepPhase;
  size?: 'sm' | 'md';
}

const phaseColors: Record<TriageStepPhase, string> = {
  safety: 'bg-red-100 text-red-700',
  assessment: 'bg-blue-100 text-blue-700',
  safe_action: 'bg-green-100 text-green-700',
  document: 'bg-purple-100 text-purple-700',
  wait: 'bg-amber-100 text-amber-700',
};

export default function TriagePhaseBadge({ phase, size = 'sm' }: Props) {
  const { t } = useTranslation();
  const color = phaseColors[phase];
  const sizeClass = size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-sm px-3 py-1';
  return (
    <span className={`inline-flex items-center gap-1 rounded-full font-medium ${color} ${sizeClass}`}>
      <TriagePhaseIcon phase={phase} className="w-3 h-3" />
      {t(`triage.phase.${phase}`)}
    </span>
  );
}
