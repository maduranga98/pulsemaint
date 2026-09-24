import { useState, useEffect, useMemo } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useDepartmentScope } from '../useDepartmentScope';
import type { WorkOrder } from '../../types';
import { useRecordPlantMatcher } from '../useRecordPlantMatcher';

export function useOpenWorkOrders(siteId: string) {
  const [allWorkOrders, setAllWorkOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!siteId) {
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'workOrders'),
      where('siteId', '==', siteId),
      where('status', 'in', ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'ON_HOLD_PARTS', 'ON_HOLD_APPROVAL']),
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((d) => ({ ...d.data(), id: d.id } as WorkOrder));
        setAllWorkOrders(data);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [siteId]);

  // Plant-scoped roles (and admin with a plant tab selected) only see work
  // orders on their own plant's machines.
  const { plantId } = useDepartmentScope();
  const inScopedPlant = useRecordPlantMatcher();
  const workOrders = useMemo(
    () => (plantId ? allWorkOrders.filter((wo) => inScopedPlant(wo)) : allWorkOrders),
    [allWorkOrders, plantId, inScopedPlant],
  );

  return { workOrders, count: workOrders.length, loading, error };
}
