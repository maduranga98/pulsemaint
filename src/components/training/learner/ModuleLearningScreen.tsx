import { useState } from 'react';
import { ArrowLeft, Clock, BookOpen } from 'lucide-react';
import type { TrainingAssignment, TrainingModule, LessonItem } from '@/lib/training/trainingTypes';
import { areAllRequiredLessonsComplete, getNextLesson, formatMinutes } from '@/lib/training/progressCalculator';
import { useLessonProgress } from '@/hooks/training/useLessonProgress';
import TrainingStatusBadge from '../shared/TrainingStatusBadge';
import TrainingProgressBar from '../shared/TrainingProgressBar';
import LessonList from './LessonList';
import LessonViewer from './LessonViewer';
import LessonCompleteOverlay from './LessonCompleteOverlay';

interface ModuleLearningScreenProps {
  assignment: TrainingAssignment;
  module: TrainingModule;
  onBack?: () => void;
  onStartQuiz?: () => void;
}

export default function ModuleLearningScreen({
  assignment,
  module,
  onBack,
  onStartQuiz,
}: ModuleLearningScreenProps) {
  const [activeLesson, setActiveLesson] = useState<LessonItem | null>(null);
  const [completedLessonTitle, setCompletedLessonTitle] = useState<string | null>(null);
  const { markLessonComplete } = useLessonProgress();

  const lessons = module.lessons ?? [];
  const lessonProgress = assignment.lessonProgress ?? {};

  const allRequiredDone = areAllRequiredLessonsComplete(lessons, lessonProgress);
  const quizStatus: 'locked' | 'available' | 'passed' =
    assignment.quizPassed
      ? 'passed'
      : allRequiredDone
      ? 'available'
      : 'locked';

  const remainingAfterComplete = (lessonId: string) => {
    const completedCount = Object.values({ ...lessonProgress, [lessonId]: { completed: true } })
      .filter((p) => p.completed).length;
    return Math.max(0, lessons.length - completedCount);
  };

  const handleLessonComplete = async (lessonId: string) => {
    const currentCompleted = Object.values(lessonProgress).filter((p) => p.completed).length;
    await markLessonComplete(assignment.id, lessonId, lessons.length, currentCompleted);
    const lesson = lessons.find((l) => l.id === lessonId);
    if (lesson) {
      setCompletedLessonTitle(lesson.title);
    }
    setActiveLesson(null);
  };

  const handleOverlayNext = () => {
    setCompletedLessonTitle(null);
    const next = getNextLesson(lessons, lessonProgress);
    if (next) setActiveLesson(next);
  };

  const handleOverlayDismiss = () => setCompletedLessonTitle(null);

  const completedCount = Object.values(lessonProgress).filter((p) => p.completed).length;

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      {/* Top bar */}
      <div className="sticky top-14 z-10 bg-white border-b border-slate-200 flex items-center gap-3 px-4 h-12">
        <button
          onClick={onBack}
          className="p-1.5 -ml-1.5 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors"
          aria-label="Back to my modules"
        >
          <ArrowLeft size={18} />
        </button>
        <h1 className="flex-1 font-semibold text-slate-900 text-sm truncate">
          {module.title}
        </h1>
        <span className="text-xs text-slate-500 shrink-0">
          {completedCount} of {lessons.length}
        </span>
      </div>

      {/* Module header card */}
      <div className="bg-white border-b border-slate-200 px-4 pt-4 pb-5">
        {/* Cover image strip */}
        <div className="w-full h-24 sm:h-32 rounded-xl bg-gradient-to-br from-blue-600 to-blue-800 mb-4 flex items-center justify-center">
          <BookOpen size={32} className="text-white/50" aria-hidden />
        </div>

        <h2 className="font-bold text-slate-900 text-xl leading-tight">{module.title}</h2>

        <div className="flex flex-wrap items-center gap-2 mt-2">
          <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-600 text-xs px-2.5 py-0.5 rounded-full font-medium">
            {module.machineName}
          </span>
          {module.estimatedMinutes > 0 && (
            <span className="inline-flex items-center gap-1 text-xs text-slate-500">
              <Clock size={12} />
              {formatMinutes(module.estimatedMinutes)}
            </span>
          )}
          <TrainingStatusBadge status={assignment.status} />
        </div>

        <div className="mt-3">
          <TrainingProgressBar progress={assignment.overallProgress} showLabel />
        </div>
      </div>

      {/* Lessons */}
      <div className="flex-1 bg-white mt-2">
        <LessonList
          lessons={lessons}
          lessonProgress={lessonProgress}
          currentLessonId={activeLesson?.id}
          quizStatus={quizStatus}
          quizScore={assignment.bestScore}
          passingScore={module.passingScore}
          onLessonClick={(lesson) => setActiveLesson(lesson)}
          onStartQuiz={onStartQuiz}
        />
      </div>

      {/* Lesson viewer overlay */}
      {activeLesson && (
        <LessonViewer
          lesson={activeLesson}
          assignmentId={assignment.id}
          progress={lessonProgress[activeLesson.id]}
          onComplete={handleLessonComplete}
          onClose={() => setActiveLesson(null)}
        />
      )}

      {/* Lesson complete overlay */}
      {completedLessonTitle && (
        <LessonCompleteOverlay
          lessonTitle={completedLessonTitle}
          remainingCount={remainingAfterComplete(
            lessons.find((l) => l.title === completedLessonTitle)?.id ?? ''
          )}
          onNext={handleOverlayNext}
          onDismiss={handleOverlayDismiss}
        />
      )}
    </div>
  );
}
