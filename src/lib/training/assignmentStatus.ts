import type { AssignmentStatus } from './trainingTypes';

/**
 * Statuses where the learner has finished everything that is theirs to do.
 *
 * Passing a module's final test moves the assignment to `awaiting_practical`,
 * where it waits for a manager to sign the practical assessment off. That is
 * not work the learner can act on, so "My Training" treats it as completed
 * (the card still badges it "Awaiting Sign-Off") instead of leaving it out of
 * both the outstanding and the completed views. `quiz_passed` is the same
 * state on assignments written before the `awaiting_practical` transition
 * existed.
 *
 * Matches how completed training is counted in `teamPerformance.service` and
 * `reports.service`.
 */
export const LEARNER_COMPLETED_STATUSES: AssignmentStatus[] = [
  'certified',
  'awaiting_practical',
  'quiz_passed',
];

/** Whether the learner has finished their part of an assignment. */
export function isLearnerCompletedStatus(status: AssignmentStatus): boolean {
  return LEARNER_COMPLETED_STATUSES.includes(status);
}

/**
 * Whether the assignment is still something the learner has to work on.
 *
 * Expired assignments are excluded — they are no longer actionable without a
 * fresh assignment — as are the completed statuses above, so the "modules to
 * complete" count on My Training never counts a module the Completed tab is
 * already showing.
 */
export function isLearnerOutstanding(status: AssignmentStatus): boolean {
  return status !== 'expired' && !isLearnerCompletedStatus(status);
}
