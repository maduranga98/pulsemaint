import { useState, useEffect } from 'react';
import { collection, query, where, orderBy, limit, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';

export interface TopMovedPart {
  partId: string;
  name: string;
  count: number;
}

const DEFAULT_WINDOW_DAYS = 30;
const HISTORY_LIMIT = 500;
const TOP_N = 5;

export function useTopMovedParts(companyId: string, windowDays: number = DEFAULT_WINDOW_DAYS) {
  const [parts, setParts] = useState<TopMovedPart[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId) {
      setLoading(false);
      return;
    }

    const since = Timestamp.fromMillis(Date.now() - windowDays * 24 * 60 * 60 * 1000);
    const q = query(
      collection(db, 'stockMovements'),
      where('companyId', '==', companyId),
      where('movementType', '==', 'issue'),
      orderBy('performedAt', 'desc'),
      limit(HISTORY_LIMIT),
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const totals = new Map<string, TopMovedPart>();
        for (const d of snapshot.docs) {
          const data = d.data();
          const performedAt = data.performedAt as Timestamp | undefined;
          if (!performedAt || performedAt.toMillis() < since.toMillis()) continue;

          const partId = data.partId as string;
          const name = (data.partName as string) ?? 'Unknown part';
          const qty = Math.abs((data.quantityChange as number) ?? 0);

          const existing = totals.get(partId);
          if (existing) {
            existing.count += qty;
          } else {
            totals.set(partId, { partId, name, count: qty });
          }
        }

        const sorted = Array.from(totals.values())
          .sort((a, b) => b.count - a.count)
          .slice(0, TOP_N);

        setParts(sorted);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [companyId, windowDays]);

  return { parts, loading, error };
}
