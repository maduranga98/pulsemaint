import { useState, useEffect, useCallback, useRef } from 'react';
import { httpsCallable } from 'firebase/functions';
import { toast } from 'sonner';
import { functions } from '@/lib/firebase';
import type {
  TrainingAssignment,
  TrainingModule,
  QuizSessionState,
  QuizQuestion,
  QuestionType,
  QuizAttemptResult,
} from '@/lib/training/trainingTypes';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function shuffleArray<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function buildSessionKey(assignmentId: string): string {
  return `quiz_session_${assignmentId}`;
}

function buildCooldownKey(assignmentId: string): string {
  return `quiz_cooldown_${assignmentId}`;
}

function getCooldownSeconds(assignmentId: string): number {
  const raw = localStorage.getItem(buildCooldownKey(assignmentId));
  if (!raw) return 0;
  const failedAt = parseInt(raw, 10);
  if (isNaN(failedAt)) return 0;
  const cooldownMs = 30 * 60 * 1000; // 30 minutes
  const remaining = Math.ceil((failedAt + cooldownMs - Date.now()) / 1000);
  return remaining > 0 ? remaining : 0;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export interface UseQuizSessionReturn {
  session: QuizSessionState | null;
  startQuiz: (assignment: TrainingAssignment, module: TrainingModule) => void;
  selectAnswer: (questionId: string, optionId: string, questionType: QuestionType) => void;
  navigateToQuestion: (index: number) => void;
  submitQuiz: () => Promise<void>;
  isSubmitting: boolean;
  cooldownSeconds: number;
}

export function useQuizSession(): UseQuizSessionReturn {
  const [session, setSession] = useState<QuizSessionState | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const submitRef = useRef<() => Promise<void>>();
  // The timer auto-submits once. If the server rejects it (e.g. offline),
  // the trainee retries with the Submit button instead of an endless loop.
  const autoSubmitTriedRef = useRef(false);

  // ---------------------------------------------------------------------------
  // Cooldown ticker
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!session) return;
    const assignmentId = session.assignmentId;
    const initial = getCooldownSeconds(assignmentId);
    setCooldownSeconds(initial);
    if (initial <= 0) return;

    const interval = setInterval(() => {
      const remaining = getCooldownSeconds(assignmentId);
      setCooldownSeconds(remaining);
      if (remaining <= 0) clearInterval(interval);
    }, 1000);

    return () => clearInterval(interval);
  }, [session?.assignmentId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------------------------------------------------------------------------
  // Countdown timer
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (!session || session.timeRemaining === null || session.timeRemaining <= 0 || session.isSubmitted) {
      return;
    }

    timerRef.current = setInterval(() => {
      setSession((prev) => {
        if (!prev || prev.timeRemaining === null) return prev;

        const next = prev.timeRemaining - 1;
        const updated: QuizSessionState = { ...prev, timeRemaining: next };
        localStorage.setItem(buildSessionKey(prev.assignmentId), JSON.stringify(updated));

        if (next <= 0) {
          // Auto-submit on next tick via effect
          clearInterval(timerRef.current!);
          timerRef.current = null;
        }

        return updated;
      });
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [session?.assignmentId, session?.isSubmitted]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-submit when time reaches 0
  useEffect(() => {
    if (
      session &&
      session.timeRemaining !== null &&
      session.timeRemaining <= 0 &&
      !session.isSubmitted &&
      !isSubmitting &&
      !autoSubmitTriedRef.current
    ) {
      autoSubmitTriedRef.current = true;
      submitRef.current?.();
    }
  }, [session?.timeRemaining, session?.isSubmitted, isSubmitting]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------------------------------------------------------------------------
  // startQuiz
  // ---------------------------------------------------------------------------
  const startQuiz = useCallback(
    (assignment: TrainingAssignment, module: TrainingModule) => {
      if (!module.quiz) return;

      // Check for crash-recovered session
      const savedRaw = localStorage.getItem(buildSessionKey(assignment.id));
      if (savedRaw) {
        try {
          const saved = JSON.parse(savedRaw) as QuizSessionState;
          // Restore, but fix startedAt back to a Date
          saved.startedAt = new Date(saved.startedAt);
          // The persisted `timeRemaining` only advances while the tab is open,
          // so simply restoring it let a trainee pause a timed test by closing
          // the page. Recompute it from wall-clock elapsed time instead.
          if (module.quiz.timeLimit > 0) {
            const elapsed = Math.floor(
              (Date.now() - saved.startedAt.getTime()) / 1000
            );
            saved.timeRemaining = Math.max(
              0,
              module.quiz.timeLimit * 60 - elapsed
            );
          }
          setSession(saved);
          return;
        } catch {
          localStorage.removeItem(buildSessionKey(assignment.id));
        }
      }

      let questions: QuizQuestion[] = module.quiz.shuffleQuestions
        ? shuffleArray(module.quiz.questions)
        : [...module.quiz.questions];

      if (module.quiz.shuffleOptions) {
        questions = questions.map((q) => ({
          ...q,
          options: shuffleArray(q.options),
        }));
      }

      const newSession: QuizSessionState = {
        assignmentId: assignment.id,
        moduleId: module.id,
        // `?? 0` — assignments written before every progress field was
        // persisted have no attemptsUsed, which produced a NaN attempt number.
        attemptNumber: (assignment.attemptsUsed ?? 0) + 1,
        startedAt: new Date(),
        timeRemaining:
          module.quiz.timeLimit > 0 ? module.quiz.timeLimit * 60 : null,
        questions,
        currentIndex: 0,
        answers: {},
        isSubmitted: false,
        results: null,
      };

      localStorage.setItem(buildSessionKey(assignment.id), JSON.stringify(newSession));
      setSession(newSession);
    },
    []
  );

  // ---------------------------------------------------------------------------
  // selectAnswer
  // ---------------------------------------------------------------------------
  const selectAnswer = useCallback(
    (questionId: string, optionId: string, questionType: QuestionType) => {
      setSession((prev) => {
        if (!prev || prev.isSubmitted) return prev;

        let newSelection: string[];

        if (questionType === 'multiple_choice') {
          const current = prev.answers[questionId] ?? [];
          newSelection = current.includes(optionId)
            ? current.filter((id) => id !== optionId)
            : [...current, optionId];
        } else {
          // single_choice or true_false — replace
          newSelection = [optionId];
        }

        const updated: QuizSessionState = {
          ...prev,
          answers: { ...prev.answers, [questionId]: newSelection },
        };

        localStorage.setItem(buildSessionKey(prev.assignmentId), JSON.stringify(updated));
        return updated;
      });
    },
    []
  );

  // ---------------------------------------------------------------------------
  // navigateToQuestion
  // ---------------------------------------------------------------------------
  const navigateToQuestion = useCallback((index: number) => {
    setSession((prev) => {
      if (!prev) return prev;
      const updated: QuizSessionState = { ...prev, currentIndex: index };
      localStorage.setItem(buildSessionKey(prev.assignmentId), JSON.stringify(updated));
      return updated;
    });
  }, []);

  // ---------------------------------------------------------------------------
  // submitQuiz
  // ---------------------------------------------------------------------------
  const submitQuiz = useCallback(async () => {
    if (!session || session.isSubmitted || isSubmitting) return;

    setIsSubmitting(true);

    try {
      // Graded on the server (submitTrainingQuiz) against the quiz stored on
      // the module, using the quiz's own pass mark — the browser only sends
      // the selected answers. The server also enforces attempts, the
      // failed-attempt cooldown and required lessons, and writes the attempt,
      // score and status; trainees cannot write those fields themselves.
      const submit = httpsCallable<
        { assignmentId: string; answers: Record<string, string[]>; startedAtMs: number },
        QuizAttemptResult & { attemptNumber: number; passingScore: number }
      >(functions, 'submitTrainingQuiz');
      const { data } = await submit({
        assignmentId: session.assignmentId,
        answers: session.answers,
        startedAtMs: session.startedAt.getTime(),
      });
      const passed = data.passed;
      const result: QuizAttemptResult = {
        score: data.score,
        passed: data.passed,
        totalQuestions: data.totalQuestions,
        correctAnswers: data.correctAnswers,
        timeTakenSeconds: data.timeTakenSeconds,
        answers: data.answers,
      };

      // Cooldown on failure. The cooldown-ticker effect only recomputes
      // `cooldownSeconds` when `session.assignmentId` changes (i.e. on quiz
      // start), so without updating state here the 30-minute retry cooldown
      // was silently skipped for the very attempt that just failed — the
      // results screen showed 0s remaining and let the trainee retry
      // immediately. Push the freshly-computed cooldown into state now.
      if (!passed) {
        localStorage.setItem(buildCooldownKey(session.assignmentId), String(Date.now()));
        setCooldownSeconds(getCooldownSeconds(session.assignmentId));
      }

      // Clear saved session
      localStorage.removeItem(buildSessionKey(session.assignmentId));
      localStorage.removeItem(`quiz_passing_${session.assignmentId}`);
      localStorage.removeItem(`quiz_bestscore_${session.assignmentId}`);
      localStorage.removeItem(`quiz_scope_${session.assignmentId}`);

      setSession((prev) =>
        prev ? { ...prev, isSubmitted: true, results: result } : prev
      );
    } catch (err) {
      console.error('Failed to submit quiz:', err);
      const message = err instanceof Error && err.message ? err.message : 'Could not submit the quiz. Please try again.';
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  }, [session, isSubmitting]);

  // Keep submitRef in sync so the auto-submit effect can call the latest version
  submitRef.current = submitQuiz;

  // Starting a quiz clears any leftover per-assignment keys an older build
  // kept in localStorage (pass mark, best score, library scope) — grading
  // now happens on the server and none of them are read any more.
  const startQuizWithPassingScore = useCallback(
    (assignment: TrainingAssignment, module: TrainingModule) => {
      localStorage.removeItem(`quiz_passing_${assignment.id}`);
      localStorage.removeItem(`quiz_bestscore_${assignment.id}`);
      localStorage.removeItem(`quiz_scope_${assignment.id}`);
      autoSubmitTriedRef.current = false;
      startQuiz(assignment, module);
    },
    [startQuiz]
  );

  return {
    session,
    startQuiz: startQuizWithPassingScore,
    selectAnswer,
    navigateToQuestion,
    submitQuiz,
    isSubmitting,
    cooldownSeconds,
  };
}
