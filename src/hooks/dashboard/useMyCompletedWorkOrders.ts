import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import type { WorkOrder } from '../../types';

// A work order counts as "completed" once the technician has finished the job,
// regardless of whether it has since been signed off or closed.
const COMPLETED_STATUSES = new Set(['COMPLETED', 'SIGNED_OFF', 'CLOSED']);

/**
 * The signed-in technician's completed work orders, live. Kept separate from
 * `useMyJobQueue` (which only surfaces active statuses) so the personal KPIs —
 * jobs completed, avg response/repair, SLA compliance — reflect finished work
 * and update automatically as jobs are completed/signed off.
 */
export function useMyCompletedWorkOrders(technicianId: string) {
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!technicianId) {
      setWorkOrders([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const q = query(
      collection(db, 'workOrders'),
      where('assignedTechnicianIds', 'array-contains', technicianId),
    );
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        setWorkOrders(
          snap.docs
            .map((d) => ({ ...d.data(), id: d.id } as WorkOrder))
            .filter((wo) => COMPLETED_STATUSES.has(wo.status)),
        );
        setLoading(false);
      },
      () => {
        setWorkOrders([]);
        setLoading(false);
      },
    );
    return () => unsubscribe();
  }, [technicianId]);

  return { workOrders, loading };
}
