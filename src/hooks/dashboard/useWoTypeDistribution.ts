import { useState, useEffect, useCallback } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';

export interface WoTypeCount {
  type: string;
  count: number;
}

export function useWoTypeDistribution(companyId: string) {
  const [data, setData] = useState<WoTypeCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const snap = await getDocs(
        query(collection(db, 'workOrders'), where('companyId', '==', companyId)),
      );
      const counts: Record<string, number> = {};
      snap.docs.forEach((d) => {
        const t = (d.data().woType as string) ?? 'OTHER';
        counts[t] = (counts[t] ?? 0) + 1;
      });
      setData(
        Object.entries(counts)
          .map(([type, count]) => ({ type, count }))
          .sort((a, b) => b.count - a.count),
      );
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { data, loading, error, refetch: fetch };
}
