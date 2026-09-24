import { useState, useEffect, useMemo } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useDepartmentScope } from '../useDepartmentScope';
import type { Breakdown } from '../../types';
import { useRecordPlantMatcher } from '../useRecordPlantMatcher';

export function useActiveBreakdowns(siteId: string, statusFilter?: (status: string) => boolean) {
  const [allBreakdowns, setAllBreakdowns] = useState<Breakdown[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!siteId) {
      setLoading(false);
      return;
    }

    // status filtered client-side: `not-in` + equality needs a composite
    // index that isn't deployed, which made this listener fail silently and
    // the dashboard show 0 active breakdowns.
    const q = query(
      collection(db, 'breakdown_tickets'),
      where('siteId', '==', siteId),
    );

    const CLOSED = new Set(['closed', 'resolved', 'cancelled']);
    const defaultFilter = (status: string) => !CLOSED.has(status);
    const filter = statusFilter ?? defaultFilter;
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs
          .map((d) => ({ ...d.data(), id: d.id } as Breakdown))
          .filter((b) => filter(b.status));
        setAllBreakdowns(data);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );

    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteId]);

  // Plant-scoped roles (and admin with a plant tab selected) only see
  // breakdowns on their own plant's machines.
  const { plantId } = useDepartmentScope();
  const inScopedPlant = useRecordPlantMatcher();
  const breakdowns = useMemo(
    () => (plantId ? allBreakdowns.filter((b) => inScopedPlant(b)) : allBreakdowns),
    [allBreakdowns, plantId, inScopedPlant],
  );

  return { breakdowns, count: breakdowns.length, loading, error };
}
