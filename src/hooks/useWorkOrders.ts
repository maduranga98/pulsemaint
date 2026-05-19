import { useEffect, useState, useCallback } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  type Query,
  type DocumentData,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { WorkOrder, WOFilters } from '../types/workOrder';
import { useAuthStore } from '../store/authStore';

interface UseWorkOrdersResult {
  workOrders: WorkOrder[];
  loading: boolean;
  error: string | null;
  totalCount: number;
  refetch: () => void;
}

export function useWorkOrders(filters?: WOFilters): UseWorkOrdersResult {
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const user = useAuthStore((s) => s.user);

  const refetch = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    if (!user?.siteId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    let q: Query<DocumentData> = query(
      collection(db, 'workOrders'),
      where('siteId', '==', user.siteId),
      orderBy('createdAt', 'desc'),
    );

    if (filters?.status?.length) {
      q = query(q, where('status', 'in', filters.status));
    }
    if (filters?.woType?.length) {
      q = query(q, where('woType', 'in', filters.woType));
    }
    if (filters?.priority?.length) {
      q = query(q, where('priority', 'in', filters.priority));
    }
    if (filters?.machineId) {
      q = query(q, where('machineId', '==', filters.machineId));
    }
    if (filters?.technicianId) {
      q = query(q, where('assignedTechnicianIds', 'array-contains', filters.technicianId));
    }

    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        let results = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as WorkOrder));

        // Client-side date filters (Firestore compound index limitation)
        if (filters?.dateFrom) {
          results = results.filter(
            (wo) => wo.createdAt?.toDate() >= filters.dateFrom!,
          );
        }
        if (filters?.dateTo) {
          results = results.filter(
            (wo) => wo.createdAt?.toDate() <= filters.dateTo!,
          );
        }

        // Search query (client-side)
        if (filters?.searchQuery) {
          const q = filters.searchQuery.toLowerCase();
          results = results.filter(
            (wo) =>
              wo.woNumber?.toLowerCase().includes(q) ||
              wo.machineName?.toLowerCase().includes(q) ||
              wo.description?.toLowerCase().includes(q),
          );
        }

        setWorkOrders(results);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );

    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.siteId, tick, JSON.stringify(filters)]);

  return { workOrders, loading, error, totalCount: workOrders.length, refetch };
}
