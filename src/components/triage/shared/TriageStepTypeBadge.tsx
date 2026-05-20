import type { TriageStepType } from '../../../types/triage';
import { stepTypeLabel } from '../../../lib/triage/triageStepTypes';

interface Props {
  type: TriageStepType;
}

const typeColors: Record<TriageStepType, string> = {
  statement: 'bg-gray-100 text-gray-600',
  yes_no: 'bg-teal-100 text-teal-700',
  multiple_choice: 'bg-indigo-100 text-indigo-700',
  photo_required: 'bg-pink-100 text-pink-700',
  number_input: 'bg-orange-100 text-orange-700',
  text_input: 'bg-cyan-100 text-cyan-700',
  checklist: 'bg-lime-100 text-lime-700',
};

export default function TriageStepTypeBadge({ type }: Props) {
  return (
    <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded ${typeColors[type]}`}>
      {stepTypeLabel(type)}
    </span>
  );
}
