import { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useDepartmentScope } from './useDepartmentScope';

/**
 * Ids of the company's users registered under the caller's scoped plant
 * (their own plant, or admin's selected plant tab), plus users with no plant
 * assigned yet — for filtering
 * person-keyed data (shift sessions, trainee programmes, training
 * attendees) that carries no plantId of its own. Returns null when the
 * caller isn't plant-scoped (admin on "All Plants"), meaning "don't filter".
 */
export function usePlantUserIds(companyId: string | undefined): Set<string> | null {
  const { plantId } = useDepartmentScope();
  const [ids, setIds] = useState<Set<string> | null>(null);

  useEffect(() => {
    if (!plantId || !companyId) {
      setIds(null);
      return;
    }
    // Start empty (not null) so nothing from other plants flashes up while
    // the roster loads.
    setIds(new Set());
    // Users with no plantId yet (registered before plants existed, or never
    // assigned one) are kept rather than silently dropped — otherwise e.g. a
    // technician on shift vanished from the supervisor's Technician Status.
    // Only people registered to a *different* plant are filtered out.
    const unsub = onSnapshot(
      collection(db, 'companies', companyId, 'users'),
      (snap) =>
        setIds(new Set(
          snap.docs
            .filter((d) => {
              const userPlant = d.data().plantId as string | null | undefined;
              return !userPlant || userPlant === plantId;
            })
            .map((d) => d.id),
        )),
      (err) => console.error('Failed to load plant users', err),
    );
    return () => unsub();
  }, [companyId, plantId]);

  return ids;
}
