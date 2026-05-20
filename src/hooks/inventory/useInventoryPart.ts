import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { InventoryPart } from '@/types/inventory';

interface UseInventoryPartResult {
  part: InventoryPart | null;
  loading: boolean;
  error: string | null;
}

export function useInventoryPart(partId: string | undefined): UseInventoryPartResult {
  const [part, setPart] = useState<InventoryPart | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!partId) {
      setPart(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const unsubscribe = onSnapshot(
      doc(db, 'inventoryParts', partId),
      (snap) => {
        if (snap.exists()) {
          setPart({ id: snap.id, ...snap.data() } as InventoryPart);
        } else {
          setPart(null);
        }
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [partId]);

  return { part, loading, error };
}
