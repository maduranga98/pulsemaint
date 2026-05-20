import { useState, useEffect } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  limit,
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import type { PMHistory } from '../../types/pm.types';

const COLLECTION = 'pm_history';

interface UsePMHistoryOptions {
  companyId: string;
  scheduleId?: string;
  limitCount?: number;
}

export function usePMHistory({ companyId, scheduleId, limitCount = 100 }: UsePMHistoryOptions) {
  const [history, setHistory] = useState<PMHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId) {
      setError('Company ID is required');
      setLoading(false);
      return;
    }

    setLoading(true);

    const constraints = [where('companyId', '==', companyId), orderBy('dueDate', 'desc')];

    if (scheduleId) {
      constraints.push(where('scheduleId', '==', scheduleId));
    }

    if (limitCount) {
      constraints.push(limit(limitCount) as any);
    }

    const q = query(collection(db, COLLECTION), ...constraints);

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const fetched = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as PMHistory[];
        setHistory(fetched);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('Error fetching PM history:', err);
        setError(err.message || 'Failed to fetch PM history');
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [companyId, scheduleId, limitCount]);

  return { history, loading, error };
}
