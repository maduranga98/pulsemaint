import { CheckCircle, PlayCircle, Circle, Lock, Video, FileText, Images, AlignLeft, type LucideIcon } from 'lucide-react';
import type { LessonItem, LessonProgress, LessonType } from '@/lib/training/trainingTypes';

interface LessonListItemProps {
  lesson: LessonItem;
  progress?: LessonProgress;
  isCurrent?: boolean;
  isLocked?: boolean;
  onClick?: () => void;
}

const TYPE_ICONS: Record<LessonType, LucideIcon> = {
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
  isLocked = false,
  onClick,
}: LessonListItemProps) {
  const isCompleted = progress?.completed ?? false;
  const TypeIcon = TYPE_ICONS[lesson.type];
  const durationLabel = formatDuration(lesson);

  const handleActivate = () => {
    if (isLocked) return;
    onClick?.();
  };

  return (
    <div
      className={[
        'flex items-center gap-3 px-4 py-3 min-h-[52px] transition-colors',
        isLocked ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
        !isLocked && isCurrent ? 'bg-blue-50' : '',
        !isLocked && !isCurrent ? 'hover:bg-slate-50' : '',
      ].join(' ')}
      onClick={handleActivate}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') handleActivate();
      }}
      role="button"
      tabIndex={isLocked ? -1 : 0}
      aria-disabled={isLocked}
      aria-label={`${isLocked ? 'Locked: ' : isCompleted ? 'Completed: ' : isCurrent ? 'Current lesson: ' : ''}${lesson.title}`}
      aria-current={isCurrent ? 'step' : undefined}
    >
      {/* Status icon */}
      <div className="shrink-0 w-6 h-6 flex items-center justify-center">
        {isLocked ? (
          <Lock size={18} className="text-slate-300" aria-hidden="true" />
        ) : isCompleted ? (
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
              isCurrent && !isLocked ? 'text-blue-700' : 'text-slate-800'
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
