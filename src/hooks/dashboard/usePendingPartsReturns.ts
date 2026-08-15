import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import type { PartsRequest } from '../../types/inventory';

// Requests still carrying an outstanding returnable item — either not yet
// handed back at all, or handed back and awaiting store keeper confirmation.
export function usePendingPartsReturns(companyId: string) {
  const [requests, setRequests] = useState<PartsRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId) {
      setLoading(false);
      return;
    }

    const q = query(collection(db, 'partsRequests'), where('companyId', '==', companyId));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs
          .map((d) => ({ ...d.data(), id: d.id } as PartsRequest))
          .filter((r) => r.items.some((i) => i.isReturnable && !i.isReturned));
        setRequests(data);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [companyId]);

  return { requests, count: requests.length, loading, error };
}
