import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { TriageStep } from '../../../types/triage';
import TriagePhaseIcon from '../shared/TriagePhaseIcon';
import TriageStepTypeBadge from '../shared/TriageStepTypeBadge';
import TriageSafetyDot from '../shared/TriageSafetyDot';

interface Props {
  step: TriageStep;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  isMobile?: boolean;
}

export default function TriageStepListItem({
  step,
  isSelected,
  onSelect,
  onDelete,
  onMoveUp,
  onMoveDown,
  isMobile = false,
}: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: step.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 p-3 rounded-xl border-2 cursor-pointer transition-colors ${
        isSelected ? 'border-[#1A56DB] bg-blue-50' : 'border-gray-200 bg-white hover:bg-gray-50'
      }`}
      onClick={onSelect}
    >
      {isMobile ? (
        <div className="flex flex-col gap-1 shrink-0">
          <button onClick={(e) => { e.stopPropagation(); onMoveUp?.(); }} className="text-gray-400 hover:text-gray-700 text-xs">▲</button>
          <button onClick={(e) => { e.stopPropagation(); onMoveDown?.(); }} className="text-gray-400 hover:text-gray-700 text-xs">▼</button>
        </div>
      ) : (
        <button
          {...attributes}
          {...listeners}
          className="text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          ⠿
        </button>
      )}

      <div className="w-6 h-6 shrink-0 text-gray-500">
        <TriagePhaseIcon phase={step.phase} className="w-4 h-4" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400 shrink-0">#{step.stepNumber}</span>
          <span className="text-sm font-medium text-gray-800 truncate">{step.title || 'Untitled step'}</span>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <TriageStepTypeBadge type={step.type} />
          <TriageSafetyDot level={step.safetyLevel} />
        </div>
      </div>

      <button
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        className="text-red-400 hover:text-red-600 text-lg leading-none shrink-0"
        aria-label="Delete step"
      >
        ×
      </button>
    </div>
  );
}
