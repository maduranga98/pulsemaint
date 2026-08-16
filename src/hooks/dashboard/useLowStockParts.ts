import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';

export interface LowStockPart {
  partId: string;
  name: string;
  currentStock: number;
  minStockLevel: number;
  deficit: number;
}

const TOP_N = 8;

// Parts currently at or below their reorder threshold, worst deficit first —
// there's no historical low-stock snapshot to trend over time, so this is a
// current-state view rather than a time series.
export function useLowStockParts(companyId: string) {
  const [parts, setParts] = useState<LowStockPart[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId) {
      setLoading(false);
      return;
    }

    const q = query(collection(db, 'inventoryParts'), where('companyId', '==', companyId));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const low = snapshot.docs
          .map((d) => {
            const data = d.data();
            const currentStock = (data.currentStock as number) ?? 0;
            const minStockLevel = (data.minStockLevel as number) ?? 0;
            return {
              partId: d.id,
              name: (data.name as string) ?? 'Unknown part',
              currentStock,
              minStockLevel,
              deficit: minStockLevel - currentStock,
            };
          })
          .filter((p) => p.minStockLevel > 0 && p.currentStock <= p.minStockLevel)
          .sort((a, b) => b.deficit - a.deficit)
          .slice(0, TOP_N);

        setParts(low);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [companyId]);

  return { parts, loading, error };
}
