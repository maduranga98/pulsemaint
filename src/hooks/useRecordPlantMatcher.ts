import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuthStore } from '../store/authStore';
import { useDepartmentScope } from './useDepartmentScope';

// ---------------------------------------------------------------------------
// One shared, live machineId → plantId map per company. Breakdowns, work
// orders and PM records carry a denormalized `machinePlantId`, but records
// created before plant stamping (and PM work orders generated server-side)
// don't — matching strictly on that field hid them from every plant-scoped
// role. Falling back to the machine's current plant keeps them visible in
// the right plant.
// ---------------------------------------------------------------------------

let currentCompanyId: string | null = null;
let machinePlants = new Map<string, string | null>();
let unsubscribe: (() => void) | null = null;
let refCount = 0;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function ensureSubscribed(companyId: string) {
  if (currentCompanyId === companyId && unsubscribe) return;
  unsubscribe?.();
  currentCompanyId = companyId;
  machinePlants = new Map();
  // Machines are keyed by siteId (== companyId), like everywhere else.
  unsubscribe = onSnapshot(
    query(collection(db, 'machines'), where('siteId', '==', companyId)),
    (snap) => {
      const next = new Map<string, string | null>();
      snap.docs.forEach((d) => next.set(d.id, (d.data().plantId as string | undefined) ?? null));
      machinePlants = next;
      emit();
    },
    (err) => console.error('Failed to load machine plants', err),
  );
}

function subscribeStore(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * `(record) => boolean` — does a machine-linked record (breakdown, work
 * order, PM schedule…) belong to the caller's scoped plant (own plant, or
 * admin's selected plant tab)? Uses the record's `machinePlantId`/`plantId`
 * when present, otherwise the plant of its machine. Always true when the
 * caller isn't plant-scoped (admin on "All Plants").
 */
export function useRecordPlantMatcher() {
  const { plantId } = useDepartmentScope();
  const companyId = useAuthStore((s) => s.userProfile?.companyId) ?? null;

  useEffect(() => {
    if (!plantId || !companyId) return;
    refCount += 1;
    ensureSubscribed(companyId);
    return () => {
      refCount -= 1;
      if (refCount === 0) {
        unsubscribe?.();
        unsubscribe = null;
        currentCompanyId = null;
      }
    };
  }, [plantId, companyId]);

  const plants = useSyncExternalStore(subscribeStore, () => machinePlants);

  return useCallback(
    (record: { machinePlantId?: string | null; plantId?: string | null; machineId?: string | null }): boolean => {
      if (!plantId) return true;
      const own = record.machinePlantId ?? record.plantId;
      if (own) return own === plantId;
      return !!record.machineId && plants.get(record.machineId) === plantId;
    },
    [plantId, plants],
  );
}
