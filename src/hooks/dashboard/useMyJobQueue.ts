import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, type Query } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import type { WorkOrder } from '../../types';

const ACTIVE_STATUSES = new Set([
  'OPEN',
  'ASSIGNED',
  'IN_PROGRESS',
  'ON_HOLD_PARTS',
  'ON_HOLD_APPROVAL',
]);

/**
 * "My Work Orders" queue.
 *
 * Technicians see WOs assigned to them. Admins / supervisors / plant managers
 * are never in `assignedTechnicianIds` (they can't be picked as assignees), so
 * the assigned-only query left their queue permanently empty. When `includeOwned`
 * is set, WOs they are the supervisor-in-charge of, or that they created, are
 * folded in too so the page is meaningful for them.
 *
 * Technicians / trainees may only *read* WOs they are assigned to (Firestore
 * rules). Their query therefore constrains on `assignedTechnicianIds
 * array-contains <their id>` — which is exactly what the security rule checks
 * (`request.auth.uid in resource.data.assignedTechnicianIds`). It intentionally
 * does NOT also filter on `siteId`: the user's mapping-doc siteId and a WO's
 * siteId are both derived from `siteIds[0] ?? companyId` in several places and
 * can drift, so a `siteId ==` filter silently dropped legitimately-assigned WOs
 * (and, combined with the old site-gated rule, rejected the whole query with
 * "Missing or insufficient permissions"). array-contains on a globally-unique
 * uid never leaks across tenants. Owners (admin / supervisor / plant manager)
 * can read the whole site, so they query on `siteId` alone and fold in the WOs
 * they supervise or created client-side.
 */
export function useMyJobQueue(technicianId: string, siteId: string, includeOwned = false) {
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!technicianId || !siteId) {
      setWorkOrders([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    // Owners can read the whole site; technicians/trainees can only read WOs
    // assigned to them, so their query must constrain on assignedTechnicianIds
    // to be permitted (and to match the security rule).
    const q: Query = includeOwned
      ? query(collection(db, 'workOrders'), where('siteId', '==', siteId))
      : query(
          collection(db, 'workOrders'),
          where('assignedTechnicianIds', 'array-contains', technicianId),
        );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs
          .map((d) => ({ ...d.data(), id: d.id } as WorkOrder))
          .filter((wo) => {
            if (!ACTIVE_STATUSES.has(wo.status)) return false;
            const mine = wo.assignedTechnicianIds?.includes(technicianId);
            if (mine) return true;
            if (!includeOwned) return false;
            return wo.supervisorInChargeId === technicianId || wo.createdBy === technicianId;
          })
          .sort((a, b) => {
            const ad = a.dueDate?.toMillis?.() ?? 0;
            const bd = b.dueDate?.toMillis?.() ?? 0;
            return ad - bd;
          });
        setWorkOrders(data);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [technicianId, siteId, includeOwned]);

  return { workOrders, loading, error };
}
