import type { UserRole } from '../../types/auth';
import type { TrainingAssignment } from './trainingTypes';

/** Roles allowed to sign off a completed training's practical assessment. */
const SIGN_OFF_ROLES: UserRole[] = ['supervisor', 'plant_manager', 'admin'];

export interface TrainingSignOffPermission {
  allowed: boolean;
  /** Why it is blocked — shown in place of the sign-off form. */
  reason?: string;
}

/**
 * Who may sign off a training that is awaiting its practical assessment.
 *
 * The sign-off is meant to be a second set of eyes: whoever handed the
 * training out cannot also certify it. So a supervisor or plant manager may
 * not sign off a training they assigned themselves — that has to come from
 * someone else (another supervisor/plant manager, or an admin). Admins are
 * exempt: they can sign off anything, including their own assignments.
 */
export function canSignOffTraining(
  assignment: Pick<TrainingAssignment, 'assignedBy'>,
  role: UserRole | undefined,
  userId: string | undefined,
): TrainingSignOffPermission {
  if (!role || !SIGN_OFF_ROLES.includes(role)) {
    return {
      allowed: false,
      reason: 'Only a supervisor, plant manager, or admin can sign off a training.',
    };
  }
  if (
    (role === 'plant_manager' || role === 'supervisor') &&
    !!userId &&
    assignment.assignedBy === userId
  ) {
    return {
      allowed: false,
      reason:
        "You assigned this training, so you can't sign it off yourself — ask another supervisor, plant manager, or an admin to sign off.",
    };
  }
  return { allowed: true };
}
