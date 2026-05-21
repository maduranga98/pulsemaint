import type { QuizQuestion, QuizAnswer, QuizAttemptResult } from './trainingTypes';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns the set of correct option IDs for a question.
 */
function getCorrectOptionIds(question: QuizQuestion): string[] {
  return question.options
    .filter((opt) => opt.isCorrect)
    .map((opt) => opt.id);
}

/**
 * Checks whether the selected option IDs exactly match the correct option IDs.
 * Works for single_choice, multiple_choice, and true_false.
 *
 * Rules:
 *  - ALL correct options must be selected.
 *  - NO incorrect options may be selected.
 */
function isAnswerCorrect(
  question: QuizQuestion,
  selectedOptionIds: string[]
): boolean {
  const correctIds = getCorrectOptionIds(question);

  // Must select the same number of options as there are correct answers
  if (selectedOptionIds.length !== correctIds.length) {
    return false;
  }

  const selectedSet = new Set(selectedOptionIds);
  return correctIds.every((id) => selectedSet.has(id));
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Scores a completed quiz attempt.
 *
 * @param questions - The ordered quiz questions (with correct-answer data).
 * @param answers   - A map of questionId → array of selected option IDs.
 * @returns         - A QuizAttemptResult with per-answer breakdown and totals.
 */
export function scoreQuizAttempt(
  questions: QuizQuestion[],
  answers: Record<string, string[]>
): QuizAttemptResult {
  let totalPoints = 0;
  let pointsEarned = 0;
  let correctAnswers = 0;

  const answerDetails: QuizAnswer[] = questions.map((question) => {
    const selectedOptionIds = answers[question.id] ?? [];
    const correct = isAnswerCorrect(question, selectedOptionIds);
    const earned = correct ? question.points : 0;

    totalPoints += question.points;
    pointsEarned += earned;
    if (correct) correctAnswers += 1;

    return {
      questionId: question.id,
      selectedOptionIds,
      isCorrect: correct,
      pointsEarned: earned,
    };
  });

  const score =
    totalPoints > 0
      ? Math.round((pointsEarned / totalPoints) * 100)
      : 0;

  return {
    score,
    passed: false, // Caller should use hasPassedQuiz() with the module's passingScore
    totalQuestions: questions.length,
    correctAnswers,
    timeTakenSeconds: 0, // Caller fills this in from session timing
    answers: answerDetails,
  };
}

/**
 * Determines whether a quiz score meets the module's passing threshold.
 *
 * @param score        - The percentage score (0–100).
 * @param passingScore - The minimum passing percentage defined on the module.
 */
export function hasPassedQuiz(score: number, passingScore: number): boolean {
  return score >= passingScore;
}
