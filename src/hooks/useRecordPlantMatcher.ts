import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuthStore } from '../store/authStore';
import { useDepartmentScope } from './useDepartmentScope';

// ---------------------------------------------------------------------------
// One shared, live machineId → { plant, department } map per company.
// Breakdowns, work orders and PM records carry denormalized
// `machinePlantId` / `machineDepartment`, but records created before plant
// stamping (and PM work orders generated server-side) may lack them, and a
// department renamed on the machine leaves old records with the old text.
// Falling back to the machine's current plant/department keeps them visible
// to the right people.
// ---------------------------------------------------------------------------

interface MachineScope {
  plantId: string | null;
  department: string | null;
}

let currentCompanyId: string | null = null;
let machineScopes = new Map<string, MachineScope>();
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
  machineScopes = new Map();
  // Machines are keyed by siteId (== companyId), like everywhere else.
  unsubscribe = onSnapshot(
    query(collection(db, 'machines'), where('siteId', '==', companyId)),
    (snap) => {
      const next = new Map<string, MachineScope>();
      snap.docs.forEach((d) => {
        const data = d.data();
        next.set(d.id, {
          plantId: (data.plantId as string | undefined) ?? null,
          department: (data.department as string | undefined) ?? null,
        });
      });
      machineScopes = next;
      emit();
    },
    (err) => console.error('Failed to load machine plants', err),
  );
}

function subscribeStore(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Department names compared the way people read them — case and spacing don't matter. */
export function sameDepartment(a: string | null | undefined, b: string | null | undefined): boolean {
  const norm = (v: string | null | undefined) => (v ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
  return !!norm(a) && norm(a) === norm(b);
}

interface ScopedRecord {
  machinePlantId?: string | null;
  plantId?: string | null;
  machineDepartment?: string | null;
  department?: string | null;
  machineId?: string | null;
  assignedTechnicianIds?: string[] | null;
}

/**
 * `(record) => boolean` — does a machine-linked record (breakdown, work
 * order, PM schedule…) belong to the caller's scope?
 *
 * - Plant: every plant-scoped role sees only its own plant (admin: the
 *   selected plant tab; everything on "All Plants").
 * - Department: technician / trainee / supervisor / floor operator see only
 *   their own department within that plant — except records assigned to
 *   them personally, which always show.
 *
 * Uses the record's own plant/department when present, otherwise its
 * machine's current plant/department.
 */
export function useRecordPlantMatcher() {
  const { plantId, department } = useDepartmentScope();
  const companyId = useAuthStore((s) => s.userProfile?.companyId) ?? null;
  const myId = useAuthStore((s) => s.userProfile?.id) ?? null;
  const scoped = !!plantId || !!department;

  useEffect(() => {
    if (!scoped || !companyId) return;
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
  }, [scoped, companyId]);

  const machines = useSyncExternalStore(subscribeStore, () => machineScopes);

  return useCallback(
    (record: ScopedRecord): boolean => {
      const machine = record.machineId ? machines.get(record.machineId) : undefined;
      if (plantId) {
        const recordPlant = record.machinePlantId ?? record.plantId ?? machine?.plantId ?? null;
        if (recordPlant !== plantId) return false;
      }
      if (department) {
        if (myId && (record.assignedTechnicianIds ?? []).includes(myId)) return true;
        const recordDepartment = record.machineDepartment || record.department || machine?.department || null;
        if (!sameDepartment(recordDepartment, department)) return false;
      }
      return true;
    },
    [plantId, department, myId, machines],
  );
}
