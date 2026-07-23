import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
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
 * The query filters only on `siteId` (an always-available single-field index)
 * and does the status + identity matching client-side, avoiding the composite
 * indexes the previous multi-constraint query needed.
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
    const q = query(collection(db, 'workOrders'), where('siteId', '==', siteId));

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
