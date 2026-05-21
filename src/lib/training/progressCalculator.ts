import type { LessonItem, LessonProgress } from './trainingTypes';

// ---------------------------------------------------------------------------
// Progress Calculations
// ---------------------------------------------------------------------------

/**
 * Calculates the overall lesson-completion percentage for an assignment.
 *
 * @param lessonProgress - Map of lessonId → LessonProgress.
 * @param totalLessons   - Total number of lessons in the module.
 * @returns              - Integer 0–100.
 */
export function calculateOverallProgress(
  lessonProgress: Record<string, LessonProgress>,
  totalLessons: number
): number {
  if (totalLessons === 0) return 0;
  const completed = countCompletedLessons(lessonProgress);
  return Math.round((completed / totalLessons) * 100);
}

/**
 * Counts how many lessons have been marked completed.
 *
 * @param lessonProgress - Map of lessonId → LessonProgress.
 * @returns              - Number of completed lessons.
 */
export function countCompletedLessons(
  lessonProgress: Record<string, LessonProgress>
): number {
  return Object.values(lessonProgress).filter((lp) => lp.completed).length;
}

/**
 * Returns true only if every lesson that has `isRequired = true` is completed.
 *
 * @param lessons        - Full ordered lesson list from the module.
 * @param lessonProgress - Map of lessonId → LessonProgress.
 */
export function areAllRequiredLessonsComplete(
  lessons: LessonItem[],
  lessonProgress: Record<string, LessonProgress>
): boolean {
  return lessons
    .filter((lesson) => lesson.isRequired)
    .every((lesson) => lessonProgress[lesson.id]?.completed === true);
}

/**
 * Returns the next lesson the trainee should work on — i.e. the first lesson
 * (by order) that is not yet completed — or null if all are done.
 *
 * @param lessons        - Full ordered lesson list from the module.
 * @param lessonProgress - Map of lessonId → LessonProgress.
 */
export function getNextLesson(
  lessons: LessonItem[],
  lessonProgress: Record<string, LessonProgress>
): LessonItem | null {
  const sorted = [...lessons].sort((a, b) => a.order - b.order);
  return sorted.find((lesson) => !lessonProgress[lesson.id]?.completed) ?? null;
}

// ---------------------------------------------------------------------------
// Formatting Helpers
// ---------------------------------------------------------------------------

/**
 * Formats a duration in seconds as a human-readable string.
 *
 * Examples:
 *   272  → "4:32"
 *   3735 → "1:02:15"
 *
 * @param seconds - Duration in whole seconds.
 */
export function formatDuration(seconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(seconds));
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;

  const paddedSecs = String(secs).padStart(2, '0');

  if (hrs > 0) {
    const paddedMins = String(mins).padStart(2, '0');
    return `${hrs}:${paddedMins}:${paddedSecs}`;
  }

  return `${mins}:${paddedSecs}`;
}

/**
 * Formats a duration in minutes as a human-readable label.
 *
 * Examples:
 *   30  → "30 min"
 *   90  → "1h 30min"
 *   60  → "1h"
 *
 * @param minutes - Duration in whole minutes.
 */
export function formatMinutes(minutes: number): string {
  const totalMinutes = Math.max(0, Math.floor(minutes));
  const hrs = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;

  if (hrs === 0) return `${mins} min`;
  if (mins === 0) return `${hrs}h`;
  return `${hrs}h ${mins}min`;
}
