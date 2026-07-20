import { useState, useEffect } from 'react';
import { collection, query, where, orderBy, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';

export interface RequestTrendPoint {
  date: string;
  count: number;
}

const WINDOW_DAYS = 30;

function dayKey(ts: Timestamp): string {
  return ts.toDate().toISOString().slice(0, 10);
}

export function usePartsRequestTrend(companyId: string) {
  const [data, setData] = useState<RequestTrendPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId) {
      setLoading(false);
      return;
    }

    const since = Timestamp.fromMillis(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const q = query(
      collection(db, 'partsRequests'),
      where('companyId', '==', companyId),
      where('requestedAt', '>=', since),
      orderBy('requestedAt', 'asc'),
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const counts = new Map<string, number>();
        for (let i = WINDOW_DAYS - 1; i >= 0; i--) {
          const key = new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
          counts.set(key, 0);
        }
        snapshot.docs.forEach((d) => {
          const requestedAt = d.data().requestedAt as Timestamp | undefined;
          if (!requestedAt) return;
          const key = dayKey(requestedAt);
          if (counts.has(key)) {
            counts.set(key, (counts.get(key) ?? 0) + 1);
          }
        });
        setData(Array.from(counts.entries()).map(([date, count]) => ({ date, count })));
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [companyId]);

  return { data, loading, error };
}
