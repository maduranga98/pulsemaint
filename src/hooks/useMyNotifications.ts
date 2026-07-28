import { useEffect, useMemo, useState } from 'react';
import { collection, doc, onSnapshot, orderBy, query, updateDoc, where, arrayUnion, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuthStore } from '@/store/authStore';
import type { DashboardNotification } from '@/types/analytics.types';

/** Notifications relevant to the signed-in user: role-targeted, user-targeted, or broadcast. */
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
    return all.filter((n) => {
      const roles = n.recipientRoles ?? [];
      const userIds = n.recipientUserIds ?? [];
      const isBroadcast = roles.length === 0 && userIds.length === 0;
      return isBroadcast || roles.includes(userProfile.role) || userIds.includes(userProfile.id);
    });
  }, [all, userProfile]);

  const unreadCount = useMemo(
    () => (userProfile ? notifications.filter((n) => !(n.readBy ?? []).includes(userProfile.id)).length : 0),
    [notifications, userProfile]
  );

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

  return { notifications, unreadCount, loading, markAsRead };
}
