import { useEffect } from 'react';
import { CheckCircle, ArrowRight } from 'lucide-react';

interface LessonCompleteOverlayProps {
  lessonTitle: string;
  remainingCount: number;
  onNext?: () => void;
  onDismiss?: () => void;
}

export default function LessonCompleteOverlay({
  lessonTitle,
  remainingCount,
  onNext,
  onDismiss,
}: LessonCompleteOverlayProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss?.();
    }, 3000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div className="fixed inset-0 z-60 bg-black/60 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full text-center space-y-4 animate-scale-in">
        <div className="flex justify-center">
          <CheckCircle size={56} className="text-green-500" />
        </div>
        <div>
          <p className="text-xl font-bold text-slate-900">Lesson complete!</p>
          <p className="text-slate-600 mt-1 text-sm truncate">{lessonTitle}</p>
        </div>
        <p className="text-slate-500 text-sm">
          {remainingCount > 0
            ? `${remainingCount} lesson${remainingCount > 1 ? 's' : ''} remaining`
            : 'All lessons complete!'}
        </p>
        {onNext && remainingCount > 0 && (
          <button
            onClick={onNext}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-xl transition-colors"
          >
            Next Lesson
            <ArrowRight size={18} />
          </button>
        )}
        <button
          onClick={onDismiss}
          className="w-full text-slate-500 hover:text-slate-700 text-sm py-2 transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  );
}
