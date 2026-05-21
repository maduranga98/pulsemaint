import type { LessonItem, LessonProgress } from '@/lib/training/trainingTypes';
import LessonListItem from './LessonListItem';
import QuizUnlockBanner from './QuizUnlockBanner';

interface LessonListProps {
  lessons: LessonItem[];
  lessonProgress: Record<string, LessonProgress>;
  currentLessonId?: string;
  quizStatus: 'locked' | 'available' | 'passed';
  quizScore?: number;
  passingScore?: number;
  onLessonClick?: (lesson: LessonItem) => void;
  onStartQuiz?: () => void;
}

export default function LessonList({
  lessons,
  lessonProgress,
  currentLessonId,
  quizStatus,
  quizScore,
  passingScore = 70,
  onLessonClick,
  onStartQuiz,
}: LessonListProps) {
  const sorted = [...lessons].sort((a, b) => a.order - b.order);

  return (
    <div className="divide-y divide-slate-100">
      {sorted.map((lesson) => (
        <LessonListItem
          key={lesson.id}
          lesson={lesson}
          progress={lessonProgress[lesson.id]}
          isCurrent={lesson.id === currentLessonId}
          onClick={() => onLessonClick?.(lesson)}
        />
      ))}

      {/* Quiz section */}
      <div className="p-4">
        {quizStatus === 'locked' && (
          <div className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-4 text-center">
            <p className="text-slate-500 text-sm">
              Complete all required lessons to unlock the quiz.
            </p>
          </div>
        )}
        {quizStatus === 'available' && onStartQuiz && (
          <QuizUnlockBanner onStartQuiz={onStartQuiz} passingScore={passingScore} />
        )}
        {quizStatus === 'passed' && (
          <div className="rounded-xl bg-green-50 border border-green-200 px-4 py-4">
            <div className="flex items-center gap-2 text-green-700 font-medium">
              <span className="text-lg">✓</span>
              <span>
                Quiz passed
                {quizScore !== undefined ? ` with ${quizScore}%` : ''}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
