import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { usePlantFilter } from '../usePlantFilter';
import type { PartsRequest } from '../../types/inventory';

export function usePendingPartsRequests(companyId: string) {
  const [requests, setRequests] = useState<PartsRequest[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId) {
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'partsRequests'),
      where('companyId', '==', companyId),
      where('status', 'in', ['pending_storekeeper', 'pending_supervisor']),
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((d) => ({ ...d.data(), id: d.id } as PartsRequest));
        setRequests(data);
        setCount(data.length);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [companyId]);

  // Own plant only; requests predating plant stamping fall back to the requester's plant.
  const { inPlant, isPlantScoped } = usePlantFilter(companyId);
  if (isPlantScoped) {
    const scoped = requests.filter((r) => inPlant(r.plantId, r.requestedBy));
    return { requests: scoped, count: scoped.length, loading, error };
  }
  return { requests, count, loading, error };
}
