import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import type { Breakdown } from '../../types';

export function useActiveBreakdowns(siteId: string) {
  const [breakdowns, setBreakdowns] = useState<Breakdown[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!siteId) {
      setLoading(false);
      return;
    }

    // status filtered client-side: `not-in` + equality needs a composite
    // index that isn't deployed, which made this listener fail silently and
    // the dashboard show 0 active breakdowns.
    const q = query(
      collection(db, 'breakdown_tickets'),
      where('siteId', '==', siteId),
    );

    const CLOSED = new Set(['closed', 'resolved', 'cancelled']);
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs
          .map((d) => ({ ...d.data(), id: d.id } as Breakdown))
          .filter((b) => !CLOSED.has(b.status));
        setBreakdowns(data);
        setCount(data.length);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [siteId]);

  return { breakdowns, count, loading, error };
}
