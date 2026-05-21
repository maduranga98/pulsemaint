import { useState, useEffect, useMemo } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import type { Breakdown } from '../../types';

export function useMttrToday(siteId: string) {
  const [breakdowns, setBreakdowns] = useState<Breakdown[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!siteId) {
      setLoading(false);
      return;
    }

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const q = query(
      collection(db, 'breakdown_tickets'),
      where('siteId', '==', siteId),
      where('status', '==', 'closed'),
      where('closedAt', '>=', startOfDay),
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((d) => ({ ...d.data(), id: d.id } as Breakdown));
        setBreakdowns(data);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [siteId]);

  const mttrHours = useMemo(() => {
    if (breakdowns.length === 0) return 0;
    const totalMinutes = breakdowns.reduce((sum, b) => {
      const start = b.repairStartedAt?.toMillis?.() ?? b.reportedAt?.toMillis?.();
      const end = b.closedAt?.toMillis?.();
      if (start && end) {
        return sum + (end - start) / 60000;
      }
      return sum;
    }, 0);
    return totalMinutes / breakdowns.length / 60;
  }, [breakdowns]);

  return { mttrHours, closedCount: breakdowns.length, loading, error };
}
