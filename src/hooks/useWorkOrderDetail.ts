import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { WorkOrder } from '../types/workOrder';

interface UseWorkOrderDetailResult {
  workOrder: WorkOrder | null;
  loading: boolean;
  error: string | null;
}

export function useWorkOrderDetail(woId: string | null | undefined): UseWorkOrderDetailResult {
  const [workOrder, setWorkOrder] = useState<WorkOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!woId) {
      setWorkOrder(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const unsubscribe = onSnapshot(
      doc(db, 'workOrders', woId),
      (snap) => {
        if (snap.exists()) {
          setWorkOrder({ id: snap.id, ...snap.data() } as WorkOrder);
        } else {
          setWorkOrder(null);
          setError('Work order not found');
        }
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [woId]);

  return { workOrder, loading, error };
}
