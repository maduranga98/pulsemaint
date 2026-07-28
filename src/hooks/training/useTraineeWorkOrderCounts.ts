import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuthStore } from '@/store/authStore';

interface UseTraineeWorkOrderCountsResult {
  counts: Record<string, number>;
  loading: boolean;
}

/** Number of work orders each user has been assigned to (as an internal
 * technician), keyed by user id — used to show "WOs joined" on the Trainee
 * Management screen. */
export function useTraineeWorkOrderCounts(): UseTraineeWorkOrderCountsResult {
  const siteId = useAuthStore((s) => s.userProfile?.siteIds?.[0] || s.userProfile?.companyId);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!siteId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const q = query(collection(db, 'workOrders'), where('siteId', '==', siteId));

    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const map: Record<string, number> = {};
        snap.docs.forEach((d) => {
          const ids = (d.data().assignedTechnicianIds ?? []) as string[];
          ids.forEach((id) => {
            map[id] = (map[id] ?? 0) + 1;
          });
        });
        setCounts(map);
        setLoading(false);
      },
      () => setLoading(false)
    );

    return () => unsubscribe();
  }, [siteId]);

  return { counts, loading };
}
