import { CheckCircle, PlayCircle, Circle, Video, FileText, Images, AlignLeft } from 'lucide-react';
import type { LessonItem, LessonProgress, LessonType } from '@/lib/training/trainingTypes';

interface LessonListItemProps {
  lesson: LessonItem;
  progress?: LessonProgress;
  isCurrent?: boolean;
  onClick?: () => void;
}

const TYPE_ICONS: Record<LessonType, React.ComponentType<{ size?: number; className?: string; 'aria-hidden'?: string }>> = {
  video: Video,
  document: FileText,
  image_gallery: Images,
  text: AlignLeft,
};

function formatDuration(lesson: LessonItem): string {
  if (lesson.type === 'video' && lesson.durationSeconds > 0) {
    const mins = Math.floor(lesson.durationSeconds / 60);
    const secs = lesson.durationSeconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }
  if (lesson.type === 'document' && lesson.pageCount > 0) {
    return `${lesson.pageCount} pages`;
  }
  if (lesson.type === 'text') {
    return 'Reading';
  }
  if (lesson.type === 'image_gallery') {
    return lesson.pageCount > 0 ? `${lesson.pageCount} slides` : 'Gallery';
  }
  return '';
}

export default function LessonListItem({
  lesson,
  progress,
  isCurrent,
  onClick,
}: LessonListItemProps) {
  const isCompleted = progress?.completed ?? false;
  const TypeIcon = TYPE_ICONS[lesson.type];
  const durationLabel = formatDuration(lesson);

  return (
    <div
      className={[
        'flex items-center gap-3 px-4 py-3 min-h-[52px] cursor-pointer transition-colors',
        isCurrent ? 'bg-blue-50' : 'hover:bg-slate-50',
      ].join(' ')}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onClick?.();
      }}
      role="button"
      tabIndex={0}
      aria-label={`${isCompleted ? 'Completed: ' : isCurrent ? 'Current lesson: ' : ''}${lesson.title}`}
      aria-current={isCurrent ? 'step' : undefined}
    >
      {/* Status icon */}
      <div className="shrink-0 w-6 h-6 flex items-center justify-center">
        {isCompleted ? (
          <CheckCircle size={22} className="text-green-500" aria-hidden="true" />
        ) : isCurrent ? (
          <PlayCircle size={22} className="text-blue-600" aria-hidden="true" />
        ) : (
          <Circle size={22} className="text-slate-300" aria-hidden="true" />
        )}
      </div>

      {/* Lesson info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-slate-400 shrink-0">{lesson.order}.</span>
          <span
            className={`text-sm font-medium truncate ${
              isCurrent ? 'text-blue-700' : 'text-slate-800'
            }`}
          >
            {lesson.title}
          </span>
        </div>
        {durationLabel && (
          <p className="text-xs text-slate-500 mt-0.5 ml-4">{durationLabel}</p>
        )}
      </div>

      {/* Type icon */}
      <div className="shrink-0">
        <TypeIcon size={16} className="text-slate-400" aria-hidden="true" />
      </div>
    </div>
  );
}
