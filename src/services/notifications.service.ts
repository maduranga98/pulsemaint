import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { UserRole } from '@/types/auth';
import type { DashboardNotificationType } from '@/types/analytics.types';

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
}

/**
 * Central write path for the in-app notification bell. Any feature that
 * needs to tell a role or a specific person about something (a work order
 * assignment, a new breakdown, a training assignment, ...) should go
 * through this instead of writing to `notifications` directly, so
 * targeting stays consistent.
 */
export async function createNotification(input: CreateNotificationInput): Promise<void> {
  const { companyId, type, message, severity = 'medium', linkTo = null, recipientRoles = [], recipientUserIds = [] } = input;
  if (!companyId) return;
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
      recipientRoles,
      recipientUserIds,
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
