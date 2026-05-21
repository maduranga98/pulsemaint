import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAssignment } from '@/hooks/training/useAssignment';
import { useQuizSession } from '@/hooks/training/useQuizSession';
import QuizPreScreen from '@/components/training/quiz/QuizPreScreen';
import QuizRunner from '@/components/training/quiz/QuizRunner';
import QuizReviewScreen from '@/components/training/quiz/QuizReviewScreen';
import QuizResultsScreen from '@/components/training/quiz/QuizResultsScreen';
import QuizAnswerReview from '@/components/training/quiz/QuizAnswerReview';

export default function QuizPage() {
  const { assignmentId } = useParams<{ assignmentId: string }>();
  const navigate = useNavigate();
  const { assignment, module, loading, error } = useAssignment(assignmentId ?? '');
  const { session, startQuiz, selectAnswer, navigateToQuestion, submitQuiz, isSubmitting, cooldownSeconds } =
    useQuizSession();
  const [showReview, setShowReview] = useState(false);

  const handleTimerExpire = () => {
    if (!session?.isSubmitted) submitQuiz();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  if (error || !assignment || !module || !module.quiz) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-3 text-slate-600">
        <p className="font-medium">Quiz not available for this module.</p>
        <button
          onClick={() => navigate(`/app/training/my-modules/${assignmentId}`)}
          className="text-blue-600 hover:underline text-sm"
        >
          Back to Module
        </button>
      </div>
    );
  }

  const quiz = module.quiz;
  const attemptsRemaining = quiz.maxAttempts === 0 ? Infinity : quiz.maxAttempts - assignment.attemptsUsed;

  // Pre-screen
  if (!session) {
    return (
      <QuizPreScreen
        quiz={quiz}
        moduleName={module.title}
        machineName={module.machineName}
        attemptsUsed={assignment.attemptsUsed}
        onStart={() => startQuiz(assignment, module)}
      />
    );
  }

  // Results
  if (session.isSubmitted && session.results) {
    return (
      <div className="pb-16">
        <QuizResultsScreen
          result={session.results}
          passingScore={quiz.passingScore}
          attemptsRemaining={typeof attemptsRemaining === 'number' && isFinite(attemptsRemaining) ? attemptsRemaining : 999}
          maxAttempts={quiz.maxAttempts}
          cooldownSeconds={cooldownSeconds}
          onRetry={() => startQuiz(assignment, module)}
          onContinue={() => navigate(`/app/training/my-modules/${assignmentId}`)}
          moduleName={module.title}
        />
        <div className="px-4 pb-8">
          <QuizAnswerReview
            questions={session.questions}
            answers={session.results.answers}
          />
        </div>
      </div>
    );
  }

  // Review screen
  if (showReview) {
    return (
      <QuizReviewScreen
        questions={session.questions}
        answers={session.answers}
        onSubmit={async () => { setShowReview(false); await submitQuiz(); }}
        onBack={() => setShowReview(false)}
        isSubmitting={isSubmitting}
      />
    );
  }

  // Active quiz
  return (
    <QuizRunner
      session={session}
      onSelectAnswer={selectAnswer}
      onNavigate={navigateToQuestion}
      onShowReview={() => setShowReview(true)}
      onTimerExpire={handleTimerExpire}
    />
  );
}
