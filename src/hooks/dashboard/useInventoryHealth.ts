import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useDepartmentScope } from '../useDepartmentScope';
import type { InventoryPart } from '../../types/inventory';

export function useInventoryHealth(companyId: string) {
  const [allParts, setParts] = useState<InventoryPart[]>([]);
  const { plantId } = useDepartmentScope();
  const parts = plantId ? allParts.filter((p) => p.plantId === plantId) : allParts;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId) {
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'inventoryParts'),
      where('companyId', '==', companyId),
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((d) => ({ ...d.data(), id: d.id } as InventoryPart));
        setParts(data);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [companyId]);

  const stats = {
    totalParts: parts.length,
    lowStockItems: parts.filter((p) => p.currentStock > 0 && p.currentStock <= (p.minStockLevel ?? 0)).length,
    outOfStockItems: parts.filter((p) => p.currentStock === 0).length,
    pendingPartsRequests: 0, // Will be populated by separate hook
  };

  return { parts, stats, loading, error };
}
