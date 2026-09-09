import { Download, CheckCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { LessonItem, LessonProgress } from '@/lib/training/trainingTypes';

interface DocumentLessonProps {
  lesson: LessonItem;
  progress?: LessonProgress;
  onComplete: (lessonId: string) => void;
}

export default function DocumentLesson({ lesson, progress, onComplete }: DocumentLessonProps) {
  const { t } = useTranslation();
  const isCompleted = progress?.completed ?? false;

  const handleMarkRead = () => {
    onComplete(lesson.id);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Sub-header */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-50 border-b border-slate-200">
        {lesson.pageCount > 0 && (
          <span className="text-sm text-slate-500">
            {t('common.trainingShared.lessonListItem.pages', { count: lesson.pageCount })}
          </span>
        )}
        <a
          href={lesson.contentUrl}
          download
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 font-medium"
          aria-label={t('common.trainingShared.documentLesson.downloadAria')}
        >
          <Download size={15} aria-hidden="true" />
          {t('common.trainingShared.documentLesson.download')}
        </a>
      </div>

      {/* PDF iframe */}
      <div className="flex-1">
        <iframe
          src={lesson.contentUrl}
          className="w-full border-0"
          style={{ height: 'calc(100vh - 180px)' }}
          title={lesson.title}
          aria-label={t('common.trainingShared.documentLesson.documentAria', { title: lesson.title })}
        />
      </div>

      {/* Footer action */}
      <div className="p-4 bg-white border-t border-slate-200">
        {isCompleted ? (
          <div className="flex items-center gap-2 text-green-600 font-medium">
            <CheckCircle size={18} aria-hidden="true" />
            <span>{t('common.trainingShared.documentLesson.markedRead')}</span>
          </div>
        ) : (
          <button
            type="button"
            onClick={handleMarkRead}
            className="w-full sm:w-auto px-6 py-3 bg-blue-600 text-white rounded-lg font-medium text-base hover:bg-blue-700 transition-colors"
            aria-label={t('common.trainingShared.documentLesson.markAsReadAria')}
          >
            {t('common.trainingShared.documentLesson.markAsRead')}
          </button>
        )}
      </div>
    </div>
  );
}
