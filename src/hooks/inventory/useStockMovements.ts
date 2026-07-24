import { useState, useEffect } from 'react';
import {
  collection,
  query,
  where,
  onSnapshot,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuthStore } from '@/store/authStore';
import type { StockMovement, MovementType } from '@/types/inventory';

export interface UseStockMovementsOptions {
  partId?: string;
  movementType?: MovementType;
  startDate?: Date;
  endDate?: Date;
  pageSize?: number;
}

interface UseStockMovementsResult {
  movements: StockMovement[];
  loading: boolean;
  error: string | null;
  totalCount: number;
}

export function useStockMovements(options: UseStockMovementsOptions = {}): UseStockMovementsResult {
  const { partId, movementType, startDate, endDate, pageSize = 100 } = options;
  const companyId = useAuthStore((s) => s.userProfile?.companyId);

  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const constraints: Parameters<typeof query>[1][] = [
      where('companyId', '==', companyId),
    ];

    if (partId) {
      constraints.push(where('partId', '==', partId));
    }

    if (movementType) {
      constraints.push(where('movementType', '==', movementType));
    }

    if (startDate) {
      constraints.push(where('performedAt', '>=', Timestamp.fromDate(startDate)));
    }

    if (endDate) {
      constraints.push(where('performedAt', '<=', Timestamp.fromDate(endDate)));
    }

    // Sorted client-side (newest first) rather than via a server orderBy — the
    // companyId + performedAt (and companyId + partId/type + performedAt)
    // combinations each need their own composite index, and a missing one made
    // the listener error out so freshly-received movements never appeared in
    // "Recent Stock Movements". Client sorting keeps it index-free and live.
    const q = query(collection(db, 'stockMovements'), ...constraints);

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const docs = snapshot.docs
          .map((d) => ({ id: d.id, ...d.data() })) as StockMovement[];
        docs.sort((a, b) => {
          const at = (a.performedAt as { seconds?: number } | null)?.seconds ?? 0;
          const bt = (b.performedAt as { seconds?: number } | null)?.seconds ?? 0;
          return bt - at;
        });
        setMovements(docs.slice(0, pageSize));
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [companyId, partId, movementType, startDate, endDate, pageSize]);

  return { movements, loading, error, totalCount: movements.length };
}
