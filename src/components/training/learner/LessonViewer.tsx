import { X } from 'lucide-react';
import type { LessonItem, LessonProgress } from '@/lib/training/trainingTypes';
import VideoLesson from './lesson-types/VideoLesson';
import DocumentLesson from './lesson-types/DocumentLesson';
import ImageGalleryLesson from './lesson-types/ImageGalleryLesson';
import TextLesson from './lesson-types/TextLesson';

interface LessonViewerProps {
  lesson: LessonItem;
  assignmentId: string;
  progress?: LessonProgress;
  onComplete: (lessonId: string) => void;
  onClose: () => void;
}

export default function LessonViewer({
  lesson,
  assignmentId,
  progress,
  onComplete,
  onClose,
}: LessonViewerProps) {
  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-white border-b border-slate-200 shrink-0">
        <button
          onClick={onClose}
          className="p-2 -ml-2 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors"
          aria-label="Close lesson"
        >
          <X size={20} />
        </button>
        <h2 className="flex-1 font-semibold text-slate-900 text-base truncate">
          {lesson.title}
        </h2>
        <span className="text-xs text-slate-500 shrink-0">
          {lesson.type === 'video' && lesson.durationSeconds > 0
            ? formatTime(lesson.durationSeconds)
            : lesson.type === 'document' && lesson.pageCount > 0
            ? `${lesson.pageCount} pages`
            : null}
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {lesson.type === 'video' && (
          <VideoLesson lesson={lesson} assignmentId={assignmentId} progress={progress} onComplete={onComplete} />
        )}
        {lesson.type === 'document' && (
          <DocumentLesson lesson={lesson} progress={progress} onComplete={onComplete} />
        )}
        {lesson.type === 'image_gallery' && (
          <ImageGalleryLesson lesson={lesson} progress={progress} onComplete={onComplete} />
        )}
        {lesson.type === 'text' && (
          <TextLesson lesson={lesson} progress={progress} onComplete={onComplete} />
        )}
      </div>
    </div>
  );
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}
