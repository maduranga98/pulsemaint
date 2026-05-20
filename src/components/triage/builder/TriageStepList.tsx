import { useTranslation } from 'react-i18next';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import type { TriageStep } from '../../../types/triage';
import TriageStepListItem from './TriageStepListItem';
import { nanoid } from 'nanoid';

interface Props {
  steps: TriageStep[];
  selectedStepId: string | null;
  onSelectStep: (stepId: string) => void;
  onStepsChange: (steps: TriageStep[]) => void;
}

function makeEmptyStep(stepNumber: number): TriageStep {
  return {
    id: nanoid(),
    stepNumber,
    phase: 'assessment',
    title: '',
    instruction: '',
    type: 'statement',
    options: [],
    checklistItems: [],
    mediaRefs: [],
    safetyLevel: 'safe',
    isEscalationStep: false,
    isQuickFixStep: false,
    requiresPhoto: false,
    requiresConfirmation: false,
    translations: {},
    estimatedSeconds: 30,
  };
}

export default function TriageStepList({
  steps,
  selectedStepId,
  onSelectStep,
  onStepsChange,
}: Props) {
  const { t } = useTranslation();

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = steps.findIndex((s) => s.id === active.id);
      const newIndex = steps.findIndex((s) => s.id === over.id);
      const reordered = arrayMove(steps, oldIndex, newIndex).map((s, i) => ({
        ...s,
        stepNumber: i + 1,
      }));
      onStepsChange(reordered);
    }
  };

  const addStep = () => {
    const newStep = makeEmptyStep(steps.length + 1);
    onStepsChange([...steps, newStep]);
    onSelectStep(newStep.id);
  };

  const deleteStep = (stepId: string) => {
    const filtered = steps
      .filter((s) => s.id !== stepId)
      .map((s, i) => ({ ...s, stepNumber: i + 1 }));
    onStepsChange(filtered);
    if (selectedStepId === stepId && filtered.length > 0) {
      onSelectStep(filtered[0].id);
    }
  };

  const moveStep = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= steps.length) return;
    const reordered = arrayMove(steps, index, newIndex).map((s, i) => ({
      ...s,
      stepNumber: i + 1,
    }));
    onStepsChange(reordered);
  };

  return (
    <div className="flex flex-col gap-2">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={steps.map((s) => s.id)} strategy={verticalListSortingStrategy}>
          {steps.map((step, i) => (
            <TriageStepListItem
              key={step.id}
              step={step}
              isSelected={selectedStepId === step.id}
              onSelect={() => onSelectStep(step.id)}
              onDelete={() => deleteStep(step.id)}
              onMoveUp={() => moveStep(i, 'up')}
              onMoveDown={() => moveStep(i, 'down')}
            />
          ))}
        </SortableContext>
      </DndContext>

      <button
        onClick={addStep}
        className="w-full border-2 border-dashed border-[#1A56DB] text-[#1A56DB] text-sm font-medium rounded-xl py-3 hover:bg-blue-50 transition-colors mt-1"
      >
        {t('triage.add_step')}
      </button>
    </div>
  );
}
