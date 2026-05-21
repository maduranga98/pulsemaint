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

    const q = query(
      collection(db, 'breakdown_tickets'),
      where('siteId', '==', siteId),
      where('status', 'not-in', ['closed', 'resolved']),
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((d) => ({ ...d.data(), id: d.id } as Breakdown));
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
