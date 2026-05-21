import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  GripVertical,
  CheckSquare,
  Square,
  AlignLeft,
  Trash2,
  Plus,
} from 'lucide-react';
import type { QuizQuestion, QuestionType } from '@/lib/training/trainingTypes';

interface QuestionListEditorProps {
  questions: QuizQuestion[];
  selectedQuestionId?: string;
  onReorder: (questions: QuizQuestion[]) => void;
  onSelectQuestion: (q: QuizQuestion) => void;
  onDeleteQuestion: (id: string) => void;
  onAddQuestion: () => void;
}

const TYPE_ICONS: Record<QuestionType, React.ReactNode> = {
  single_choice: <CheckSquare size={14} className="text-blue-500" />,
  multiple_choice: <Square size={14} className="text-purple-500" />,
  true_false: <AlignLeft size={14} className="text-emerald-500" />,
};

const TYPE_LABELS: Record<QuestionType, string> = {
  single_choice: 'Single',
  multiple_choice: 'Multiple',
  true_false: 'T/F',
};

interface SortableQuestionRowProps {
  question: QuizQuestion;
  index: number;
  isSelected: boolean;
  onSelect: (q: QuizQuestion) => void;
  onDelete: (id: string) => void;
}

function SortableQuestionRow({
  question,
  index,
  isSelected,
  onSelect,
  onDelete,
}: SortableQuestionRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: question.id,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1 : 'auto',
  };

  const previewText =
    question.text.length > 50 ? `${question.text.slice(0, 50)}…` : question.text;

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={() => onSelect(question)}
      className={`flex items-center gap-2 p-3 rounded-xl border cursor-pointer transition-colors ${
        isSelected
          ? 'border-blue-400 bg-blue-50'
          : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
      } ${isDragging ? 'shadow-lg' : ''}`}
    >
      {/* Drag handle */}
      <button
        type="button"
        {...attributes}
        {...listeners}
        onClick={(e) => e.stopPropagation()}
        className="text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing flex-shrink-0"
        aria-label="Drag to reorder"
      >
        <GripVertical size={16} />
      </button>

      {/* Q number */}
      <span className="text-xs font-bold text-gray-400 w-5 flex-shrink-0 text-center">
        {index + 1}
      </span>

      {/* Type icon */}
      <span className="flex-shrink-0" title={TYPE_LABELS[question.type]}>
        {TYPE_ICONS[question.type]}
      </span>

      {/* Preview text */}
      <p className="flex-1 text-sm text-gray-700 truncate min-w-0">
        {previewText || <span className="text-gray-400 italic">Untitled question</span>}
      </p>

      {/* Points badge */}
      <span className="text-xs font-medium text-gray-500 bg-gray-100 rounded-full px-2 py-0.5 flex-shrink-0">
        {question.points}pt
      </span>

      {/* Delete */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDelete(question.id);
        }}
        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
        aria-label="Delete question"
      >
        <Trash2 size={13} />
      </button>
    </div>
  );
}

export default function QuestionListEditor({
  questions,
  selectedQuestionId,
  onReorder,
  onSelectQuestion,
  onDeleteQuestion,
  onAddQuestion,
}: QuestionListEditorProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = questions.findIndex((q) => q.id === active.id);
    const newIndex = questions.findIndex((q) => q.id === over.id);
    const reordered = arrayMove(questions, oldIndex, newIndex).map((q, i) => ({
      ...q,
      order: i + 1,
    }));
    onReorder(reordered);
  }

  const totalPoints = questions.reduce((sum, q) => sum + q.points, 0);

  return (
    <div className="flex flex-col gap-3">
      {questions.length > 0 && (
        <div className="flex items-center justify-between px-1">
          <span className="text-xs text-gray-400">
            {questions.length} question{questions.length !== 1 ? 's' : ''}
          </span>
          <span className="text-xs text-gray-400">{totalPoints} pts total</span>
        </div>
      )}

      {questions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 border-2 border-dashed border-gray-200 rounded-xl text-center">
          <CheckSquare size={28} className="text-gray-300 mb-2" />
          <p className="text-sm font-medium text-gray-500">No questions yet.</p>
          <p className="text-xs text-gray-400">Add your first question.</p>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={questions.map((q) => q.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="flex flex-col gap-1.5">
              {questions.map((question, index) => (
                <SortableQuestionRow
                  key={question.id}
                  question={question}
                  index={index}
                  isSelected={selectedQuestionId === question.id}
                  onSelect={onSelectQuestion}
                  onDelete={onDeleteQuestion}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <button
        type="button"
        onClick={onAddQuestion}
        className="flex items-center justify-center gap-2 border-2 border-dashed border-blue-300 text-blue-600 hover:border-blue-400 hover:bg-blue-50 rounded-xl py-3 text-sm font-medium transition-colors"
      >
        <Plus size={16} />
        Add Question
      </button>
    </div>
  );
}
