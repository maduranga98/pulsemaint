import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import type { InventoryPart } from '../../types/inventory';

/** Live list of every inventory part in the company (filter client-side, like the other dashboard hooks). */
export function useCompanyParts(companyId: string) {
  const [parts, setParts] = useState<InventoryPart[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    const unsub = onSnapshot(
      query(collection(db, 'inventoryParts'), where('companyId', '==', companyId)),
      (snap) => {
        setParts(snap.docs.map((d) => ({ ...d.data(), id: d.id }) as InventoryPart));
        setLoading(false);
      },
      () => setLoading(false),
    );
    return () => unsub();
  }, [companyId]);

  return { parts, loading };
}
