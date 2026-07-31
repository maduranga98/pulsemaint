import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuthStore } from '@/store/authStore';
import type { WorkOrder } from '@/types/workOrder';

interface Result {
  workOrders: WorkOrder[];
  loading: boolean;
  error: string | null;
}

/**
 * Completed work orders for the Sign-Off Queue, scoped by `companyId`.
 *
 * The general-purpose `useWorkOrders` hook filters by `siteId`, but the
 * workOrders read rule grants oversight roles (plant_manager / admin) and
 * supervisors access by *company*, not site. A site-filtered query can match a
 * legacy WO whose `companyId` doesn't line up, which makes Firestore reject the
 * whole query with "Missing or insufficient permissions". Querying by
 * `companyId` (the field the rule actually checks) matches how the analytics
 * dashboards safely read work orders. Status is filtered client-side so no
 * extra composite index is required.
 */
export function useCompletedWorkOrdersForSignOff(): Result {
  const companyId = useAuthStore((s) => s.userProfile?.companyId);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const unsub = onSnapshot(
      query(collection(db, 'workOrders'), where('companyId', '==', companyId)),
      (snap) => {
        const rows = snap.docs
          .map((d) => ({ id: d.id, ...d.data() } as WorkOrder))
          .filter((w) => w.status === 'COMPLETED')
          .sort((a, b) => {
            const at = (a.actualEndTime as { toMillis?: () => number } | null | undefined)?.toMillis?.() ?? 0;
            const bt = (b.actualEndTime as { toMillis?: () => number } | null | undefined)?.toMillis?.() ?? 0;
            return bt - at;
          });
        setWorkOrders(rows);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );
    return () => unsub();
  }, [companyId]);

  return { workOrders, loading, error };
}
