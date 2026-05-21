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
  Video,
  FileText,
  Images,
  AlignLeft,
  Pencil,
  Trash2,
  Plus,
} from 'lucide-react';
import type { LessonItem, LessonType } from '@/lib/training/trainingTypes';

interface LessonListEditorProps {
  lessons: LessonItem[];
  onReorder: (lessons: LessonItem[]) => void;
  onEditLesson: (lesson: LessonItem) => void;
  onDeleteLesson: (lessonId: string) => void;
  onAddLesson: () => void;
  selectedLessonId?: string;
}

const TYPE_ICONS: Record<LessonType, React.ReactNode> = {
  video: <Video size={16} className="text-purple-500" />,
  document: <FileText size={16} className="text-blue-500" />,
  image_gallery: <Images size={16} className="text-emerald-500" />,
  text: <AlignLeft size={16} className="text-orange-500" />,
};

const TYPE_LABELS: Record<LessonType, string> = {
  video: 'Video',
  document: 'Document',
  image_gallery: 'Gallery',
  text: 'Text',
};

interface SortableRowProps {
  lesson: LessonItem;
  isSelected: boolean;
  onEdit: (lesson: LessonItem) => void;
  onDelete: (id: string) => void;
}

function SortableRow({ lesson, isSelected, onEdit, onDelete }: SortableRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: lesson.id,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1 : 'auto',
  };

  function formatDuration(seconds: number): string {
    if (!seconds) return '';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
        isSelected
          ? 'border-blue-400 bg-blue-50'
          : 'border-gray-200 bg-white hover:border-gray-300'
      } ${isDragging ? 'shadow-lg' : ''}`}
    >
      {/* Drag handle */}
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing flex-shrink-0"
        aria-label="Drag to reorder"
      >
        <GripVertical size={18} />
      </button>

      {/* Type icon */}
      <span className="flex-shrink-0">{TYPE_ICONS[lesson.type]}</span>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-800 truncate">{lesson.title || 'Untitled lesson'}</p>
        <p className="text-xs text-gray-400 truncate">
          {TYPE_LABELS[lesson.type]}
          {lesson.durationSeconds ? ` · ${formatDuration(lesson.durationSeconds)}` : ''}
          {lesson.description ? ` · ${lesson.description}` : ''}
        </p>
      </div>

      {/* Required badge */}
      {lesson.isRequired && (
        <span className="text-xs font-medium text-orange-600 bg-orange-50 border border-orange-200 rounded-full px-2 py-0.5 flex-shrink-0">
          Required
        </span>
      )}

      {/* Actions */}
      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          type="button"
          onClick={() => onEdit(lesson)}
          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
          aria-label="Edit lesson"
        >
          <Pencil size={15} />
        </button>
        <button
          type="button"
          onClick={() => onDelete(lesson.id)}
          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          aria-label="Delete lesson"
        >
          <Trash2 size={15} />
        </button>
      </div>
    </div>
  );
}

export default function LessonListEditor({
  lessons,
  onReorder,
  onEditLesson,
  onDeleteLesson,
  onAddLesson,
  selectedLessonId,
}: LessonListEditorProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = lessons.findIndex((l) => l.id === active.id);
    const newIndex = lessons.findIndex((l) => l.id === over.id);
    const reordered = arrayMove(lessons, oldIndex, newIndex).map((l, i) => ({
      ...l,
      order: i + 1,
    }));
    onReorder(reordered);
  }

  return (
    <div className="flex flex-col gap-3">
      {lessons.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed border-gray-200 rounded-xl text-center">
          <AlignLeft size={32} className="text-gray-300 mb-3" />
          <p className="text-sm font-medium text-gray-500">No lessons yet.</p>
          <p className="text-xs text-gray-400">Add your first lesson.</p>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={lessons.map((l) => l.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="flex flex-col gap-2">
              {lessons.map((lesson) => (
                <SortableRow
                  key={lesson.id}
                  lesson={lesson}
                  isSelected={selectedLessonId === lesson.id}
                  onEdit={onEditLesson}
                  onDelete={onDeleteLesson}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <button
        type="button"
        onClick={onAddLesson}
        className="flex items-center justify-center gap-2 border-2 border-dashed border-blue-300 text-blue-600 hover:border-blue-400 hover:bg-blue-50 rounded-xl py-3 text-sm font-medium transition-colors"
      >
        <Plus size={16} />
        Add Lesson
      </button>
    </div>
  );
}
