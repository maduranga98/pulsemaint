import { useState, useEffect, useCallback } from 'react';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';

export type RequestReason = 'PM' | 'Breakdown' | 'Other';

export interface RequestReasonCount {
  reason: RequestReason;
  count: number;
}

function toReason(workOrderType: string | null): RequestReason {
  switch (workOrderType) {
    case 'PREVENTIVE':
      return 'PM';
    case 'BREAKDOWN':
    case 'CORRECTIVE':
      return 'Breakdown';
    default:
      return 'Other';
  }
}

// windowDays — omit (or 0) for all-time, otherwise scoped to the trailing N days.
export function usePartsRequestReasons(companyId: string, windowDays: number = 0) {
  const [data, setData] = useState<RequestReasonCount[]>([]);
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
      const constraints = [where('companyId', '==', companyId)];
      if (windowDays > 0) {
        const since = Timestamp.fromMillis(Date.now() - windowDays * 24 * 60 * 60 * 1000);
        constraints.push(where('requestedAt', '>=', since));
      }
      const snap = await getDocs(query(collection(db, 'partsRequests'), ...constraints));
      const counts: Record<RequestReason, number> = { PM: 0, Breakdown: 0, Other: 0 };
      snap.docs.forEach((d) => {
        const reason = toReason((d.data().workOrderType as string) ?? null);
        counts[reason] += 1;
      });
      setData(
        (['PM', 'Breakdown', 'Other'] as RequestReason[])
          .map((reason) => ({ reason, count: counts[reason] }))
          .sort((a, b) => b.count - a.count),
      );
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [companyId, windowDays]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { data, loading, error, refetch: fetch };
}
