import type { UserRole } from '../../types/auth';

/**
 * Roles that oversee the whole plant and are copied on every targeted
 * notification, whichever role or person raised the action.
 */
export const OVERSIGHT_ROLES: UserRole[] = ['admin', 'plant_manager'];

/**
 * Recipient roles actually written to a notification.
 *
 * A targeted notification (one that names roles and/or specific users) is
 * copied to the oversight roles: admins and plant managers are accountable
 * for everything happening in the plant, and previously only saw the subset
 * of notifications that happened to name their role.
 *
 * A broadcast (neither roles nor users named) is left as a broadcast — every
 * role already sees it, and adding roles would narrow it to just those two.
 *
 * Kept free of Firebase imports so it stays unit-testable on its own.
 */
export function resolveRecipientRoles(
  recipientRoles: UserRole[],
  recipientUserIds: string[],
): UserRole[] {
  const isBroadcast = recipientRoles.length === 0 && recipientUserIds.length === 0;
  if (isBroadcast) return [];
  return Array.from(new Set<UserRole>([...recipientRoles, ...OVERSIGHT_ROLES]));
}
