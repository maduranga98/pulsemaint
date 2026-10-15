/**
 * Server-side quiz scoring — the same rules as src/lib/training/quizScorer.ts
 * (keep both in sync), run by submitTrainingQuiz against the quiz stored on
 * the module so a trainee can no longer report their own score.
 */

/**
 * Correct option ids of a question.
 * @param {object} question quiz question
 * @return {string[]} ids of the options marked correct
 */
function correctOptionIds(question) {
  return (Array.isArray(question.options) ? question.options : [])
      .filter((opt) => opt && opt.isCorrect)
      .map((opt) => String(opt.id));
}

/**
 * All correct options selected and no incorrect ones.
 * @param {object} question quiz question
 * @param {string[]} selected selected option ids
 * @return {boolean} whether the answer is right
 */
function isAnswerCorrect(question, selected) {
  const correct = correctOptionIds(question);
  if (selected.length !== correct.length) return false;
  const set = new Set(selected);
  return correct.every((id) => set.has(id));
}

/**
 * Scores a submitted attempt.
 * @param {object[]} questions the module's quiz questions (with answers)
 * @param {Object<string, string[]>} answers questionId → selected option ids
 * @return {{score: number, totalQuestions: number, correctAnswers: number, answers: object[]}}
 */
function scoreQuizAttempt(questions, answers) {
  let totalPoints = 0;
  let pointsEarned = 0;
  let correctAnswers = 0;
  const details = questions.map((question) => {
    const raw = answers[question.id];
    const selected = Array.isArray(raw) ? [...new Set(raw.map((v) => String(v)))] : [];
    const points = Number.isFinite(Number(question.points)) ? Number(question.points) : 1;
    const correct = isAnswerCorrect(question, selected);
    const earned = correct ? points : 0;
    totalPoints += points;
    pointsEarned += earned;
    if (correct) correctAnswers += 1;
    return {questionId: question.id, selectedOptionIds: selected, isCorrect: correct, pointsEarned: earned};
  });
  const score = totalPoints > 0 ? Math.round((pointsEarned / totalPoints) * 100) : 0;
  return {score, totalQuestions: questions.length, correctAnswers, answers: details};
}

/**
 * @param {number} score percentage score
 * @param {number} passingScore pass mark
 * @return {boolean} passed
 */
function hasPassedQuiz(score, passingScore) {
  return score >= passingScore;
}

/**
 * Attempts left — null means unlimited (maxAttempts missing or 0).
 * @param {number} maxAttempts quiz attempt limit
 * @param {number} attemptsUsed attempts already used
 * @return {number|null} attempts left
 */
function attemptsRemaining(maxAttempts, attemptsUsed) {
  const max = Number.isFinite(Number(maxAttempts)) ? Number(maxAttempts) : 0;
  const used = Number.isFinite(Number(attemptsUsed)) ? Number(attemptsUsed) : 0;
  if (max <= 0) return null;
  return Math.max(0, max - used);
}

/**
 * Every lesson marked required has been completed.
 * @param {object[]} lessons module lessons
 * @param {Object<string, object>} lessonProgress assignment lesson progress
 * @return {boolean} all required lessons done
 */
function requiredLessonsComplete(lessons, lessonProgress) {
  const progress = lessonProgress || {};
  return (Array.isArray(lessons) ? lessons : [])
      .filter((l) => l && l.isRequired)
      .every((l) => progress[l.id] && progress[l.id].completed === true);
}

module.exports = {scoreQuizAttempt, hasPassedQuiz, attemptsRemaining, requiredLessonsComplete};
