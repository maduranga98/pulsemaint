import { useState, useEffect, useMemo } from 'react';
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuthStore } from '../../store/authStore';
import { isNotificationForUser } from '../../lib/notifications/recipients';
import type { DashboardNotification } from '../../types/analytics.types';

/**
 * Dashboard notification feed. Applies the same strict targeting as the
 * notification bell — a notification raised for one role never shows up on
 * another role's dashboard. Unlike the bell it keeps read notifications,
 * since the dashboard feed is a recent-activity view rather than a to-do list.
 */
export function useNotifications(companyId: string) {
  const userProfile = useAuthStore((s) => s.userProfile);
  const [all, setAll] = useState<DashboardNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId) {
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'notifications'),
      where('companyId', '==', companyId),
      orderBy('timestamp', 'desc'),
      limit(50),
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((d) => ({ ...d.data(), id: d.id } as DashboardNotification));
        setAll(data);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [companyId]);

  const notifications = useMemo(
    () => all.filter((n) => isNotificationForUser(n, userProfile?.role, userProfile?.id)),
    [all, userProfile],
  );

  return { notifications, loading, error };
}
