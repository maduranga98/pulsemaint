import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useDepartmentScope } from './useDepartmentScope';

/**
 * Ids of the machines registered under the caller's scoped plant (own plant,
 * or admin's selected plant tab) — for scoping machine-keyed records
 * (contractor jobs, MOE, kaizen) that carry no plantId of their own.
 * Null when the caller isn't plant-scoped (admin on "All Plants").
 */
export function usePlantMachineIds(companyId: string | undefined): Set<string> | null {
  const { plantId } = useDepartmentScope();
  const [ids, setIds] = useState<Set<string> | null>(null);

  useEffect(() => {
    if (!plantId || !companyId) {
      setIds(null);
      return;
    }
    setIds(new Set());
    // Machines are keyed by siteId (== companyId), like everywhere else.
    const unsub = onSnapshot(
      query(collection(db, 'machines'), where('siteId', '==', companyId), where('plantId', '==', plantId)),
      (snap) => setIds(new Set(snap.docs.map((d) => d.id))),
      (err) => console.error('Failed to load plant machines', err),
    );
    return () => unsub();
  }, [companyId, plantId]);

  return ids;
}
