import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { QuizSessionState, QuestionType } from '@/lib/training/trainingTypes';
import QuizQuestion from './QuizQuestion';
import QuizProgressBar from './QuizProgressBar';
import QuizTimer from './QuizTimer';

interface QuizRunnerProps {
  session: QuizSessionState;
  onSelectAnswer: (questionId: string, optionId: string, questionType: QuestionType) => void;
  onNavigate: (index: number) => void;
  onShowReview: () => void;
  onTimerExpire: () => void;
}

export default function QuizRunner({
  session,
  onSelectAnswer,
  onNavigate,
  onShowReview,
  onTimerExpire,
}: QuizRunnerProps) {
  const { questions, currentIndex, answers, timeRemaining } = session;
  const answeredCount = Object.values(answers).filter((a) => a.length > 0).length;
  const isLast = currentIndex === questions.length - 1;
  const currentQuestion = questions[currentIndex];
  const currentAnswers = answers[currentQuestion?.id ?? ''] ?? [];

  return (
    <div className="flex flex-col min-h-screen bg-white">
      {/* Top bar */}
      <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-4 py-3 space-y-2">
        <QuizProgressBar
          current={currentIndex + 1}
          total={questions.length}
          answeredCount={answeredCount}
        />
        {timeRemaining !== null && timeRemaining > 0 && (
          <div className="flex justify-end">
            <QuizTimer totalSeconds={timeRemaining} onExpire={onTimerExpire} />
          </div>
        )}
      </div>

      {/* Mobile: single question */}
      <div className="flex-1 px-4 py-6 max-w-2xl mx-auto w-full sm:hidden">
        {currentQuestion && (
          <QuizQuestion
            question={currentQuestion}
            questionNumber={currentIndex + 1}
            selectedOptionIds={currentAnswers}
            onAnswer={(qId, oId) => onSelectAnswer(qId, oId, currentQuestion.type)}
          />
        )}
      </div>

      {/* Desktop: all questions */}
      <div className="hidden sm:block flex-1 px-6 py-6 max-w-3xl mx-auto w-full space-y-8">
        {questions.map((q, i) => (
          <div key={q.id} id={`question-${i}`}>
            <QuizQuestion
              question={q}
              questionNumber={i + 1}
              selectedOptionIds={answers[q.id] ?? []}
              onAnswer={(qId, oId) => onSelectAnswer(qId, oId, q.type)}
            />
          </div>
        ))}
        <div className="pt-4">
          <button
            onClick={onShowReview}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-4 rounded-xl text-lg transition-colors"
          >
            Review & Submit
          </button>
        </div>
      </div>

      {/* Mobile navigation */}
      <div className="sm:hidden sticky bottom-0 bg-white border-t border-slate-200 px-4 py-3 flex gap-3">
        <button
          onClick={() => onNavigate(currentIndex - 1)}
          disabled={currentIndex === 0}
          className="flex items-center gap-1 px-4 py-3 rounded-xl border border-slate-200 text-slate-700 disabled:opacity-40 font-medium flex-1 justify-center"
          aria-label="Previous question"
        >
          <ChevronLeft size={18} /> Previous
        </button>
        {isLast ? (
          <button
            onClick={onShowReview}
            className="flex items-center gap-1 px-4 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium flex-1 justify-center"
          >
            Review & Submit <ChevronRight size={18} />
          </button>
        ) : (
          <button
            onClick={() => onNavigate(currentIndex + 1)}
            className="flex items-center gap-1 px-4 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium flex-1 justify-center"
            aria-label="Next question"
          >
            Next <ChevronRight size={18} />
          </button>
        )}
      </div>
    </div>
  );
}
