import { useState, useEffect, useCallback, useRef } from 'react';
import { doc, updateDoc, arrayUnion, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { scoreQuizAttempt, hasPassedQuiz } from '@/lib/training/quizScorer';
import type {
  TrainingAssignment,
  TrainingModule,
  QuizSessionState,
  QuizQuestion,
  QuestionType,
  QuizAttempt,
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
      !isSubmitting
    ) {
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
      // Always derive elapsed time from wall-clock time. The previous
      // fallback (`questions.length * 60`) when the countdown hit zero was an
      // arbitrary guess unrelated to how long the trainee actually spent, and
      // skewed reports/analytics that key off timeTakenSeconds.
      const timeTakenSeconds = Math.round(
        (Date.now() - session.startedAt.getTime()) / 1000
      );

      const raw = scoreQuizAttempt(session.questions, session.answers);

      // We need the module's passingScore — fetch from the session's questions context.
      // passingScore lives on the module; we resolve it from the assignment doc update.
      // For now, use the module's passingScore that was baked into the session start.
      // The caller (startQuiz) stored questions with full data so we rely on hasPassedQuiz
      // called with the score we get and the module's passingScore stored in Firestore.
      // We'll write passed=false initially and compute it after reading from Firestore.
      // Instead, derive passingScore from the quiz metadata on the module embedded in assignment.
      // The cleanest approach: the component that calls startQuiz passes the module;
      // here we recalculate using the score against the assignment's linked module passingScore.
      // We store module.passingScore in session via a convention:
      // Actually we don't have it here — we'll compute passed=false at write time
      // and let Firestore rules / security handle it. The component should call submitQuiz
      // with access to the module. But per spec, submitQuiz takes no args.
      // Workaround: use the quiz's passingScore field if available on the questions array
      // or store it in session state. We'll extend QuizSessionState in the session object
      // as a local-only field (the type doesn't prevent extra keys at runtime).
      // Best approach: store passingScore in localStorage alongside the session.
      const passingScoreRaw = localStorage.getItem(`quiz_passing_${session.assignmentId}`);
      const passingScore = passingScoreRaw ? parseInt(passingScoreRaw, 10) : 70;

      const passed = hasPassedQuiz(raw.score, passingScore);

      // Trainee-programme modules (Trainee Management library) are not signed
      // off or certified one-by-one: passing the module's final test just
      // completes it (`quiz_passed`). The single practical sign-off — and the
      // one programme certificate — happen once, at programme completion.
      // Marking the module `certified` here would fire the
      // `generateTrainingCertificate` Cloud Function and mint a certificate per
      // module, which is exactly what we must avoid. Regular training-library
      // modules keep the per-module practical sign-off (`awaiting_practical`).
      const isProgrammeModule =
        localStorage.getItem(`quiz_scope_${session.assignmentId}`) === 'trainee_management';

      const result = { ...raw, passed, timeTakenSeconds };

      // Firestore has no atomic "keep the max" update, so we read the prior
      // best score (persisted alongside the session at startQuiz) and only
      // move it up — otherwise a lower-scoring retry silently overwrote a
      // previously passing bestScore shown across the app and used to
      // compute the trainee's final programme mark.
      const priorBestRaw = localStorage.getItem(`quiz_bestscore_${session.assignmentId}`);
      const priorBest = priorBestRaw ? parseInt(priorBestRaw, 10) : 0;
      const bestScore = Math.max(priorBest, result.score);

      const attemptId = `attempt_${session.attemptNumber}_${Date.now()}`;
      const now = Timestamp.now();

      const attempt: QuizAttempt = {
        attemptId,
        attemptNumber: session.attemptNumber,
        startedAt: Timestamp.fromDate(session.startedAt),
        completedAt: now,
        score: result.score,
        passed,
        totalQuestions: result.totalQuestions,
        correctAnswers: result.correctAnswers,
        answers: result.answers,
        timeTakenSeconds: result.timeTakenSeconds,
      };

      const assignmentRef = doc(db, 'trainingAssignments', session.assignmentId);

      await updateDoc(assignmentRef, {
        quizAttempts: arrayUnion(attempt),
        attemptsUsed: session.attemptNumber,
        latestScore: result.score,
        bestScore,
        quizPassed: passed,
        ...(passed
          ? isProgrammeModule
            ? {
                quizPassedAt: now,
                status: 'quiz_passed',
                completedAt: now,
              }
            : {
                quizPassedAt: now,
                status: 'awaiting_practical',
              }
          : {
              status: 'quiz_failed',
            }),
        lastActivityAt: now,
      });

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
    } finally {
      setIsSubmitting(false);
    }
  }, [session, isSubmitting]);

  // Keep submitRef in sync so the auto-submit effect can call the latest version
  submitRef.current = submitQuiz;

  // Extended startQuiz that also persists passingScore
  const startQuizWithPassingScore = useCallback(
    (assignment: TrainingAssignment, module: TrainingModule) => {
      if (module.quiz) {
        // The pass mark shown to the trainee (pre-screen, results screen) comes
        // from the quiz, which the quiz builder edits independently of the
        // module-level default. Grading against `module.passingScore` meant a
        // trainee could be failed against a different threshold than the one
        // displayed. Prefer the quiz's own pass mark.
        localStorage.setItem(
          `quiz_passing_${assignment.id}`,
          String(module.quiz.passingScore ?? module.passingScore)
        );
        localStorage.setItem(
          `quiz_bestscore_${assignment.id}`,
          String(assignment.bestScore ?? 0)
        );
        // Remember whether this is a trainee-programme module so submitQuiz can
        // decide between an outright completion and a per-module sign-off.
        localStorage.setItem(`quiz_scope_${assignment.id}`, module.libraryScope ?? 'training');
      }
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
