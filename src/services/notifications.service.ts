import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { UserRole } from '@/types/auth';
import type { DashboardNotificationType } from '@/types/analytics.types';
import { OVERSIGHT_ROLES, resolveRecipientRoles } from '@/lib/notifications/recipients';
import { useAuthStore } from '@/store/authStore';
import { useActivePlantStore } from '@/store/activePlantStore';
import { resolveScopedPlantId } from '@/hooks/useDepartmentScope';

export { OVERSIGHT_ROLES, resolveRecipientRoles };

interface CreateNotificationInput {
  companyId: string;
  type: DashboardNotificationType;
  message: string;
  severity?: 'critical' | 'high' | 'medium' | 'low';
  linkTo?: string | null;
  /** Notify everyone with one of these roles. */
  recipientRoles?: UserRole[];
  /** Notify these specific users, in addition to any recipientRoles. */
  recipientUserIds?: string[];
  /** Who performed the action. Shown to oversight readers so the entry reads
   *  as "Name (Role) — did X" rather than as a message addressed to them. */
  actorName?: string | null;
  actorRole?: UserRole | null;
  /** The actor's user id. Lets their own entries read as "You ..." instead of
   *  naming them — oversight roles are copied on their own actions too. */
  actorUserId?: string | null;
  /** Third-person phrasing of `message`, for oversight readers. */
  oversightMessage?: string | null;
  /** Plant the event belongs to — only that plant's people see it. Defaults
   *  to the creator's plant (admin: the selected plant tab). */
  plantId?: string | null;
  /** Department the event concerns (e.g. the machine's) — department-scoped
   *  roles outside it don't see it. Defaults to none (whole plant). */
  department?: string | null;
}

/**
 * Central write path for the in-app notification bell. Any feature that
 * needs to tell a role or a specific person about something (a work order
 * assignment, a new breakdown, a training assignment, ...) should go
 * through this instead of writing to `notifications` directly, so
 * targeting stays consistent.
 *
 * Admins and plant managers are copied on every targeted notification: they
 * are accountable for everything happening in the plant, and previously only
 * saw the subset of notifications that happened to name their role. A
 * broadcast (no roles and no users) is left untouched — it already reaches
 * everyone, and narrowing it to the oversight roles would hide it from the
 * people it was meant for.
 */
export async function createNotification(input: CreateNotificationInput): Promise<void> {
  const {
    companyId,
    type,
    message,
    severity = 'medium',
    linkTo = null,
    recipientRoles = [],
    recipientUserIds = [],
    actorName = null,
    actorRole = null,
    actorUserId = null,
    oversightMessage = null,
    department = null,
  } = input;
  if (!companyId) return;
  const plantId =
    input.plantId !== undefined
      ? input.plantId
      : resolveScopedPlantId(useAuthStore.getState().userProfile, useActivePlantStore.getState().activePlantId);
  const roles = resolveRecipientRoles(recipientRoles, recipientUserIds);
  try {
    await addDoc(collection(db, 'notifications'), {
      companyId,
      type,
      message,
      severity,
      linkTo,
      timestamp: serverTimestamp(),
      read: false,
      readBy: [],
      recipientRoles: roles,
      recipientUserIds,
      // Who it was originally raised for, before the oversight copy was
      // appended — the bell needs this to tell "addressed to me" from
      // "I'm seeing it as oversight" and word the entry accordingly.
      targetRoles: recipientRoles,
      targetUserIds: recipientUserIds,
      actorName,
      actorRole,
      actorUserId,
      oversightMessage,
      plantId: plantId ?? null,
      department: department || null,
    });
  } catch (err) {
    // Notifications are best-effort — never let a failed notification write
    // fail the primary action (creating a WO, assigning training, etc.).
    console.error('Failed to create notification', err);
  }
}

/** Convenience wrapper for notifying every user with one of the given roles. */
export function notifyRoles(
  companyId: string,
  roles: UserRole[],
  notification: Omit<CreateNotificationInput, 'companyId' | 'recipientRoles'>
): Promise<void> {
  return createNotification({ ...notification, companyId, recipientRoles: roles });
}

/** Convenience wrapper for notifying a specific set of users. */
export function notifyUsers(
  companyId: string,
  userIds: string[],
  notification: Omit<CreateNotificationInput, 'companyId' | 'recipientUserIds'>
): Promise<void> {
  const ids = userIds.filter(Boolean);
  if (ids.length === 0) return Promise.resolve();
  return createNotification({ ...notification, companyId, recipientUserIds: ids });
}
