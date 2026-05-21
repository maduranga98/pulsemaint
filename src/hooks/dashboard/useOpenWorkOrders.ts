import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import type { WorkOrder } from '../../types';

export function useOpenWorkOrders(siteId: string) {
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!siteId) {
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'work_orders'),
      where('siteId', '==', siteId),
      where('status', 'in', ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'ON_HOLD_PARTS', 'ON_HOLD_APPROVAL']),
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((d) => ({ ...d.data(), id: d.id } as WorkOrder));
        setWorkOrders(data);
        setCount(data.length);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [siteId]);

  return { workOrders, count, loading, error };
}
