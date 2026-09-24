import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useDepartmentScope } from './useDepartmentScope';

/**
 * Ids of the inventory parts registered under the caller's scoped plant
 * (own plant, or admin's selected plant tab) — for scoping part-keyed
 * records (stock movements, returns) that carry no plantId of their own.
 * Null when the caller isn't plant-scoped (admin on "All Plants").
 */
export function usePlantPartIds(companyId: string | undefined): Set<string> | null {
  const { plantId } = useDepartmentScope();
  const [ids, setIds] = useState<Set<string> | null>(null);

  useEffect(() => {
    if (!plantId || !companyId) {
      setIds(null);
      return;
    }
    setIds(new Set());
    const unsub = onSnapshot(
      query(collection(db, 'inventoryParts'), where('companyId', '==', companyId), where('plantId', '==', plantId)),
      (snap) => setIds(new Set(snap.docs.map((d) => d.id))),
      (err) => console.error('Failed to load plant parts', err),
    );
    return () => unsub();
  }, [companyId, plantId]);

  return ids;
}
