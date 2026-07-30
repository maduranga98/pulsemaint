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

/** Human-readable role labels used when an action is attributed to someone. */
const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  plant_manager: 'Plant Manager',
  supervisor: 'Supervisor',
  technician: 'Technician',
  store_keeper: 'Store Keeper',
  hr_officer: 'HR Officer',
  trainee: 'Trainee',
  floor_operator: 'Floor Operator',
  safety_officer: 'Safety Officer',
};

export function roleLabel(role: string | null | undefined): string {
  if (!role) return '';
  return ROLE_LABELS[role] ?? role.replace(/_/g, ' ');
}

/** The fields a notification carries about who performed the action. */
export interface NotificationActor {
  /** Roles the notification was raised for, before the oversight copy. */
  targetRoles?: string[] | null;
  targetUserIds?: string[] | null;
  actorName?: string | null;
  actorRole?: string | null;
  /** Who performed the action, so their own entries can read as "You ...". */
  actorUserId?: string | null;
  /** Third-person phrasing for people reading this as oversight. */
  oversightMessage?: string | null;
}

/**
 * Whether the signed-in user is the person who performed the action.
 *
 * Their own entries are worded in the second person ("You signed off ...")
 * instead of naming them, which is what a plant manager or admin expects when
 * they see the oversight copy of something they did themselves.
 */
export function isOwnAction(
  notification: NotificationActor,
  userId: string | undefined,
): boolean {
  return !!userId && !!notification.actorUserId && notification.actorUserId === userId;
}

/**
 * Whether a notification was raised for this user in particular — their own
 * role was named, or they were named by id. The distinction from the oversight
 * copy decides whether the stored second-person message still applies.
 */
export function isAddressedToUser(
  notification: NotificationActor,
  role: UserRole | undefined,
  userId: string | undefined,
): boolean {
  const targetRoles = notification.targetRoles ?? [];
  const targetUserIds = notification.targetUserIds ?? [];
  if (!!userId && targetUserIds.includes(userId)) return true;
  return !!role && targetRoles.includes(role as string);
}

/**
 * An admin action a plant manager has no part in.
 *
 * Plant managers are copied on everything so nothing in the plant goes
 * unseen, but admin work is company administration (users, billing, company
 * settings, other sites) rather than plant operations — it filled the plant
 * manager's bell with entries they can't act on. Admin actions raised *for*
 * the plant manager (their role named, or them named by id) still come
 * through, as does anything they did themselves.
 *
 * Admins keep seeing everything, including other admins' actions.
 */
export function isHiddenAdminAction(
  notification: NotificationActor,
  role: UserRole | undefined,
  userId: string | undefined,
): boolean {
  if (role !== 'plant_manager') return false;
  if (notification.actorRole !== 'admin') return false;
  if (isOwnAction(notification, userId)) return false;
  return !isAddressedToUser(notification, role, userId);
}

/**
 * Whether a notification belongs in this user's bell at all: targeted at
 * them, and not an admin action a plant manager has no part in.
 */
export function isNotificationVisibleTo(
  notification: NotificationTargeting & NotificationActor,
  role: UserRole | undefined,
  userId: string | undefined,
): boolean {
  if (!isNotificationForUser(notification, role, userId)) return false;
  return !isHiddenAdminAction(notification, role, userId);
}

/**
 * Whether this user is seeing the notification only because they are an
 * oversight role, rather than because it was raised for them.
 *
 * The distinction matters for wording: a message written for its target
 * ("You've been assigned a new training module") reads as though it is
 * addressed to the plant manager when they see the oversight copy, which is
 * what made the bell look like other roles' notifications were leaking in.
 */
export function isOversightCopy(
  notification: NotificationActor,
  role: UserRole | undefined,
  userId: string | undefined,
): boolean {
  if (!role || !OVERSIGHT_ROLES.includes(role)) return false;
  const targetRoles = notification.targetRoles ?? [];
  const targetUserIds = notification.targetUserIds ?? [];
  // No recorded target means we can't tell — treat it as addressed to them
  // and leave the wording alone.
  if (targetRoles.length === 0 && targetUserIds.length === 0) return false;
  if (!!userId && targetUserIds.includes(userId)) return false;
  return !targetRoles.includes(role as string);
}

/**
 * Rewrites a stored message so it addresses the person who performed the
 * action: "New parts request from Chamathka Perera" → "New parts request from
 * you". Used only as a fallback for notifications written without a
 * third-person `oversightMessage`.
 */
function addressActorAsYou(message: string, actorName: string | null | undefined): string {
  const actor = (actorName ?? '').trim();
  if (!actor) return message;
  const escaped = actor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return message.replace(new RegExp(escaped, 'g'), (_match, offset: number) =>
    offset === 0 ? 'You' : 'you',
  );
}

/**
 * What to show in this user's notification bar.
 *
 * Three wordings, in priority order:
 *  - The reader performed the action: second person, "You signed off
 *    "Electrical Trainee Orientation" for Julia Perera". A plant manager or
 *    admin sees their own work in their bell (they are copied on everything)
 *    and it should not read as though a stranger with their name did it.
 *  - The reader is one of the people it was raised for: the stored message,
 *    which is already written to them ("You've been assigned ...").
 *  - Anyone else's action, seen by an oversight reader: attributed with name
 *    and role — "Julia Perera (Trainee) — passed the final test for
 *    Electrical Trainee Orientation".
 */
export function notificationDisplayMessage(
  notification: NotificationActor & { message: string },
  role: UserRole | undefined,
  userId: string | undefined,
): string {
  const actor = (notification.actorName ?? '').trim();
  const oversightBody = (notification.oversightMessage ?? '').trim();

  if (isOwnAction(notification, userId)) {
    return oversightBody
      ? `You ${oversightBody}`
      : addressActorAsYou(notification.message, notification.actorName);
  }

  // Someone else's action. Oversight roles get it attributed by name and role,
  // whether it named their role or reached them as the oversight copy —
  // "Nuwan Silva (Supervisor) — ..." rather than a message that reads as
  // though it were addressed to them. A notification raised for them
  // personally keeps its own wording, which already says "you"/"your".
  const attributed =
    !!role &&
    OVERSIGHT_ROLES.includes(role) &&
    !!actor &&
    !(!!userId && (notification.targetUserIds ?? []).includes(userId));

  if (!attributed && !isOversightCopy(notification, role, userId)) return notification.message;

  const label = roleLabel(notification.actorRole);
  const body = oversightBody || notification.message;
  if (!actor) return body;
  return label ? `${actor} (${label}) — ${body}` : `${actor} — ${body}`;
}
