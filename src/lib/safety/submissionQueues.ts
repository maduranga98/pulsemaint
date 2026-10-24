import type { TrainingAssignment } from '@/lib/training/trainingTypes';
import {
  getFinalScore,
  getInviteAccess,
  inviteDueMillis,
  isSafetyCardValid,
  type ContractorSafetyCard,
  type ContractorSafetyTrainingInvite,
} from './contractorSafety';

/**
 * The only three views of the safety-training submissions tabs:
 *  - toSignoff:    review and sign off (and then export the card)
 *  - reassignable: needs a new link / a fresh attempt
 *  - expired:      the safety period has ended — renew by reassigning
 */
export type SubmissionQueue = 'toSignoff' | 'reassignable' | 'expired';
export const SUBMISSION_QUEUES: SubmissionQueue[] = ['toSignoff', 'reassignable', 'expired'];

/** Which queue a contractor team member's invite belongs to (null = none, e.g. waiting on the person or already replaced). */
export function getInviteQueue(
  inv: ContractorSafetyTrainingInvite,
  card: ContractorSafetyCard | null,
  nowMs: number = Date.now(),
): SubmissionQueue | null {
  if (inv.status === 'reassigned') return null;
  if (inv.status === 'signed_off') {
    if (!card) return 'toSignoff'; // signed off, card still to be exported
    // The card's period ended (or it was revoked): the person has to be trained again.
    return isSafetyCardValid(card, nowMs) ? null : 'expired';
  }
  const access = getInviteAccess({ ...inv, dueAtMs: inviteDueMillis(inv) }, nowMs);
  const submitted = inv.status === 'submitted' || (inv.attemptsUsed || 0) > 0;
  const finalScore = getFinalScore(inv);
  const belowPass = inv.hasQuiz && (finalScore ?? 0) < inv.passingScore;
  if (submitted && !belowPass) return 'toSignoff';
  // Link closed without a passing submission (due date gone / attempts used up), or a failed final attempt.
  if (!access.open || submitted) return 'reassignable';
  return null;
}

/** Which queue a company user's in-app safety training assignment belongs to. */
export function getAssignmentQueue(a: TrainingAssignment, nowMs: number = Date.now()): SubmissionQueue | null {
  if (a.status === 'expired') return 'expired';
  if (a.status === 'certified') {
    const exp = (a.certificateExpiryDate as unknown as { toMillis?: () => number } | null)?.toMillis?.();
    return exp && exp <= nowMs ? 'expired' : null;
  }
  if (a.status === 'quiz_passed' || a.status === 'awaiting_practical') return 'toSignoff';
  if (a.status === 'quiz_failed' || a.status === 'retraining_required') return 'reassignable';
  const due = (a.dueDate as unknown as { toMillis?: () => number } | null)?.toMillis?.();
  if (due && due < nowMs) return 'reassignable'; // never finished and now overdue
  return null;
}
