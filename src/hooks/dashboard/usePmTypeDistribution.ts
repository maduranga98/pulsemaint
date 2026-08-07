import { useState, useEffect, useCallback } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { toDate, monthKey } from '../../services/analyticsAggregation';
import type { PMType } from '../../types/pm.types';

export interface PmTypeCount {
  pmType: PMType;
  count: number;
}

// Preventive work orders carry their pmType directly on the workOrders doc
// (set from the PM Type picker at creation — see useCreateWorkOrder.ts),
// even though the WorkOrder TS interface doesn't declare the field.
// `months` (the Analytics page's MTD/3M/6M/12M range) scopes the count to
// the selected period, same as the other range-aware charts.
export function usePmTypeDistribution(companyId: string, months?: string[]) {
  const [data, setData] = useState<PmTypeCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const monthsKey = months?.join(',') ?? '';

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
      const monthSet = monthsKey ? new Set(monthsKey.split(',')) : null;
      const counts: Record<string, number> = {};
      snap.docs.forEach((d) => {
        const wo = d.data();
        if (monthSet) {
          const d2 = toDate(wo.actualEndTime ?? wo.createdAt);
          if (!d2 || !monthSet.has(monthKey(d2))) return;
        }
        const t = (wo.pmType as string) || 'other';
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, monthsKey]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { data, loading, error, refetch: fetch };
}
