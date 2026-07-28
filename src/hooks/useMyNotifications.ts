import { useEffect, useMemo, useState } from 'react';
import { collection, doc, onSnapshot, orderBy, query, updateDoc, where, arrayUnion, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuthStore } from '@/store/authStore';
import { isNotificationForUser, isNotificationUnreadBy } from '@/lib/notifications/recipients';
import type { DashboardNotification } from '@/types/analytics.types';

/**
 * Notifications currently waiting for the signed-in user.
 *
 * Two rules, both enforced through the pure helpers in
 * `lib/notifications/recipients`:
 *  - Targeting is strict — one role's notifications never appear in another
 *    role's bar; only the oversight roles (admin, plant_manager) are copied
 *    on everything, and that copy is made at write time.
 *  - Reading one clears it. The bar is a list of things still to look at, so
 *    a notification the user has already opened drops out of it. `readBy` is
 *    per-user, so clearing yours never hides it from anyone else.
 */
export function useMyNotifications() {
  const userProfile = useAuthStore((s) => s.userProfile);
  const companyId = userProfile?.companyId ?? '';
  const [all, setAll] = useState<DashboardNotification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    const q = query(
      collection(db, 'notifications'),
      where('companyId', '==', companyId),
      orderBy('timestamp', 'desc'),
      limit(100)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setAll(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as DashboardNotification));
        setLoading(false);
      },
      () => setLoading(false)
    );
    return () => unsub();
  }, [companyId]);

  const notifications = useMemo(() => {
    if (!userProfile) return [];
    return all.filter(
      (n) =>
        isNotificationForUser(n, userProfile.role, userProfile.id) &&
        isNotificationUnreadBy(n, userProfile.id)
    );
  }, [all, userProfile]);

  // Everything still listed is unread — reading removes it from the list.
  const unreadCount = notifications.length;

  async function markAsRead(notificationId: string) {
    if (!userProfile) return;
    try {
      await updateDoc(doc(db, 'notifications', notificationId), {
        readBy: arrayUnion(userProfile.id),
      });
    } catch (err) {
      console.error('Failed to mark notification as read', err);
    }
  }

  /** Clears every notification currently in this user's bar. */
  async function markAllAsRead() {
    if (!userProfile) return;
    const ids = notifications.map((n) => n.id);
    await Promise.all(
      ids.map((id) =>
        updateDoc(doc(db, 'notifications', id), { readBy: arrayUnion(userProfile.id) }).catch((err) =>
          console.error('Failed to mark notification as read', err)
        )
      )
    );
  }

  return { notifications, unreadCount, loading, markAsRead, markAllAsRead };
}
