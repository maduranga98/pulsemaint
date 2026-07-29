import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuthStore } from '@/store/authStore';
import type { WorkOrder } from '@/types/workOrder';

interface UseContractorWorkOrdersResult {
  workOrders: WorkOrder[];
  loading: boolean;
}

/**
 * Contractor-type work orders belonging to one contractor.
 *
 * A contractor's job history used to read `contractorJobs` alone, but nothing
 * in the app creates those documents — contractor work is raised as a
 * CONTRACTOR work order instead. So the history was empty even for
 * contractors with signed-off jobs, and the cost/rating captured at work
 * order sign-off had nowhere to surface. This is the second source.
 */
export function useContractorWorkOrders(contractorId?: string): UseContractorWorkOrdersResult {
  const companyId = useAuthStore((s) => s.userProfile?.companyId);
  const siteId = useAuthStore((s) => s.userProfile?.siteIds?.[0]) ?? companyId;
  const [all, setAll] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!siteId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsub = onSnapshot(
      query(collection(db, 'workOrders'), where('siteId', '==', siteId), where('woType', '==', 'CONTRACTOR')),
      (snap) => {
        setAll(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as WorkOrder));
        setLoading(false);
      },
      () => {
        setAll([]);
        setLoading(false);
      },
    );
    return () => unsub();
  }, [siteId]);

  const workOrders = useMemo(() => {
    const millis = (wo: WorkOrder) => wo.createdAt?.toMillis?.() ?? 0;
    return all
      .filter((wo) => !contractorId || wo.contractorCompanyId === contractorId)
      .sort((a, b) => millis(b) - millis(a));
  }, [all, contractorId]);

  return { workOrders, loading };
}
