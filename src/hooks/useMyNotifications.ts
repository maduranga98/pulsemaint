import { useEffect, useMemo, useRef, useState } from 'react';
import { collection, doc, onSnapshot, orderBy, query, updateDoc, where, arrayUnion, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuthStore } from '@/store/authStore';
import { isNotificationUnreadBy, isNotificationVisibleTo, notificationDisplayMessage, notificationLocationLabel } from '@/lib/notifications/recipients';
import { playNotificationSound, showDeviceNotification } from '@/lib/notifications/deviceNotify';
import type { DashboardNotification } from '@/types/analytics.types';
import { useDepartmentScope } from '@/hooks/useDepartmentScope';
import { usePlants } from '@/hooks/usePlants';

/**
 * Notifications currently waiting for the signed-in user.
 *
 * Two rules, both enforced through the pure helpers in
 * `lib/notifications/recipients`:
 *  - Targeting is strict — a notification reaches only the roles and people it
 *    names. Admins and plant managers are not copied on everything: each sees
 *    only what was raised for their role or for them personally, and a plant
 *    manager only from their own plant. Every entry shows its plant and, when
 *    known, its department.
 *  - Reading one clears it. The bar is a list of things still to look at, so
 *    a notification the user has already opened drops out of it. `readBy` is
 *    per-user, so clearing yours never hides it from anyone else.
 */
export function useMyNotifications() {
  const userProfile = useAuthStore((s) => s.userProfile);
  const companyId = userProfile?.companyId ?? '';
  const [all, setAll] = useState<DashboardNotification[]>([]);
  const [loading, setLoading] = useState(true);
  // Only this user's plant (admin: selected plant tab) and, for
  // department-scoped roles, their department.
  const { plantId: scopedPlantId, department } = useDepartmentScope();
  // Admin's plant tab (All Plants / a plant) filters the modules, not the
  // bell: admins always get every plant's notifications, each labelled with
  // its plant. Plant-scoped roles still only see their own plant.
  const plantId = userProfile?.role === 'admin' ? null : scopedPlantId;
  const { plants } = usePlants(companyId);
  const plantNames = useMemo(() => new Map(plants.map((p) => [p.id, p.name])), [plants]);

  useEffect(() => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    const q = query(
      collection(db, 'notifications'),
      where('companyId', '==', companyId),
      orderBy('timestamp', 'desc'),
      limit(300)
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
        isNotificationVisibleTo(n, userProfile.role, userProfile.id, { plantId, department }) &&
        isNotificationUnreadBy(n, userProfile.id)
    );
  }, [all, userProfile, plantId, department]);

  // Everything still listed is unread — reading removes it from the list.
  const unreadCount = notifications.length;

  // Fire a device notification + sound for anything that shows up in this
  // user's bar after the first load — covers every role/module that goes
  // through createNotification(), generically, without a per-feature hook.
  const seenIdsRef = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (!userProfile) return;
    const ids = new Set(notifications.map((n) => n.id));
    if (seenIdsRef.current === null) {
      // First render for this session/user — don't replay the existing backlog.
      seenIdsRef.current = ids;
      return;
    }
    const previouslySeen = seenIdsRef.current;
    const freshOnes = notifications.filter((n) => !previouslySeen.has(n.id));
    seenIdsRef.current = ids;
    if (freshOnes.length === 0) return;
    playNotificationSound();
    for (const n of freshOnes.slice(0, 5)) {
      // "Plant · Department" so the reader knows where it came from.
      const where = notificationLocationLabel(n, plantNames);
      showDeviceNotification(where ? `FirmiCore · ${where}` : 'FirmiCore', {
        body: `${where ? `[${where}] ` : ''}${notificationDisplayMessage(n, userProfile.role, userProfile.id)}`,
        tag: n.id,
        onClick: () => {
          if (n.linkTo) window.location.assign(n.linkTo);
        },
      });
    }
  }, [notifications, userProfile, plantNames]);

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

  return { notifications, unreadCount, loading, markAsRead, markAllAsRead, plantNames };
}
