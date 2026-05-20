import { useTranslation } from 'react-i18next';
import type { TriageOutcomeType } from '../../../types/triage';

interface Props {
  outcome: TriageOutcomeType | null;
  notes?: string;
}

const outcomeColors: Record<TriageOutcomeType, string> = {
  resolved_by_operator: 'border-green-400 bg-green-50 text-green-800',
  repair_team_required: 'border-amber-400 bg-amber-50 text-amber-800',
  machine_shutdown: 'border-orange-400 bg-orange-50 text-orange-800',
  emergency_escalated: 'border-red-400 bg-red-50 text-red-800',
  abandoned: 'border-gray-300 bg-gray-50 text-gray-700',
};

export default function TriageOutcomeCard({ outcome, notes }: Props) {
  const { t } = useTranslation();
  if (!outcome) return null;
  const colorClass = outcomeColors[outcome];
  return (
    <div className={`border-l-4 rounded p-3 ${colorClass}`}>
      <p className="font-semibold text-sm">{t(`triage.outcome.${outcome}`)}</p>
      {notes && <p className="text-sm mt-1 opacity-80">{notes}</p>}
    </div>
  );
}
