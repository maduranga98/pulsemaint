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

/** The targeting fields on a stored notification. Roles are plain strings
 *  because that is how they come back from Firestore. */
export interface NotificationTargeting {
  recipientRoles?: string[] | null;
  recipientUserIds?: string[] | null;
}

/**
 * Whether a notification belongs in this user's notification bar.
 *
 * Targeting is strict: a notification raised for one role never shows up in
 * another role's bar. The only cross-role visibility is the oversight roles
 * (admin, plant_manager), which `resolveRecipientRoles` writes onto every
 * targeted notification so plant leadership sees everything.
 *
 * A notification with no targeting at all — only legacy documents written
 * before targeting existed — goes to the oversight roles rather than to
 * everyone, so it is still visible somewhere without leaking to every role.
 */
export function isNotificationForUser(
  notification: NotificationTargeting,
  role: UserRole | undefined,
  userId: string | undefined,
): boolean {
  const roles = notification.recipientRoles ?? [];
  const userIds = notification.recipientUserIds ?? [];

  if (roles.length === 0 && userIds.length === 0) {
    return !!role && OVERSIGHT_ROLES.includes(role);
  }
  if (!!userId && userIds.includes(userId)) return true;
  return !!role && roles.includes(role as string);
}

/**
 * Whether a notification should still appear for this user.
 *
 * Reading a notification removes it from that user's bar — the bar is a
 * to-see list, not an archive. `readBy` is per-user, so one person clearing
 * theirs never hides it from anyone else.
 */
export function isNotificationUnreadBy(
  notification: { readBy?: string[] | null },
  userId: string | undefined,
): boolean {
  if (!userId) return true;
  return !(notification.readBy ?? []).includes(userId);
}
