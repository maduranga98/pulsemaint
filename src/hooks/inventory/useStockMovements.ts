import { useState, useEffect } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
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

    constraints.push(orderBy('performedAt', 'desc'));

    const q = query(collection(db, 'stockMovements'), ...constraints);

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const docs = snapshot.docs
          .slice(0, pageSize)
          .map((d) => ({ id: d.id, ...d.data() })) as StockMovement[];
        setMovements(docs);
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
