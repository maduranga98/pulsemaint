import { useState, useEffect, useCallback } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  doc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuthStore } from '../store/authStore';
import type { UserNotification } from '../types/comments';

/** Live per-user inbox (mentions + comment notifications) for the topbar. */
export function useInbox() {
  const userId = useAuthStore((s) => s.userProfile?.id);
  const [items, setItems] = useState<UserNotification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const q = query(
      collection(db, 'userNotifications'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(30),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setItems(snap.docs.map((d) => ({ ...d.data(), id: d.id } as UserNotification)));
        setLoading(false);
      },
      () => setLoading(false),
    );
    return () => unsub();
  }, [userId]);

  const unreadCount = items.filter((i) => !i.read).length;

  const markRead = useCallback(async (id: string) => {
    try {
      await updateDoc(doc(db, 'userNotifications', id), { read: true });
    } catch {
      /* no-op */
    }
  }, []);

  const markAllRead = useCallback(async () => {
    const unread = items.filter((i) => !i.read);
    if (unread.length === 0) return;
    try {
      const batch = writeBatch(db);
      unread.forEach((i) => batch.update(doc(db, 'userNotifications', i.id), { read: true }));
      await batch.commit();
    } catch {
      /* no-op */
    }
  }, [items]);

  return { items, unreadCount, loading, markRead, markAllRead };
}
