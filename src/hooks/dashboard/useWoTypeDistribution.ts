import { useState, useEffect, useCallback } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { toDate, monthKey } from '../../services/analyticsAggregation';

export interface WoTypeCount {
  type: string;
  count: number;
}

// Accepts siteId (which equals companyId in single-site setups) so the query
// matches the siteId-based security rules on the workOrders collection.
// `months` (the Analytics page's MTD/3M/6M/12M range) scopes the count to
// the selected period, same as the other range-aware charts.
export function useWoTypeDistribution(companyId: string, months?: string[]) {
  const [data, setData] = useState<WoTypeCount[]>([]);
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
        query(collection(db, 'workOrders'), where('siteId', '==', companyId)),
      );
      const monthSet = monthsKey ? new Set(monthsKey.split(',')) : null;
      const counts: Record<string, number> = {};
      snap.docs.forEach((d) => {
        const wo = d.data();
        if (monthSet) {
          const d2 = toDate(wo.actualEndTime ?? wo.createdAt);
          if (!d2 || !monthSet.has(monthKey(d2))) return;
        }
        const t = (wo.woType as string) ?? 'OTHER';
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, monthsKey]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { data, loading, error, refetch: fetch };
}
