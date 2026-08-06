import { useState, useEffect, useCallback } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import type { PMType } from '../../types/pm.types';

export interface PmTypeCount {
  pmType: PMType;
  count: number;
}

// Preventive work orders carry their pmType directly on the workOrders doc
// (set from the PM Type picker at creation — see useCreateWorkOrder.ts),
// even though the WorkOrder TS interface doesn't declare the field.
export function usePmTypeDistribution(companyId: string) {
  const [data, setData] = useState<PmTypeCount[]>([]);
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
        query(
          collection(db, 'workOrders'),
          where('siteId', '==', companyId),
          where('woType', '==', 'PREVENTIVE'),
        ),
      );
      const counts: Record<string, number> = {};
      snap.docs.forEach((d) => {
        const t = (d.data().pmType as string) || 'other';
        counts[t] = (counts[t] ?? 0) + 1;
      });
      setData(
        Object.entries(counts)
          .map(([pmType, count]) => ({ pmType: pmType as PMType, count }))
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
