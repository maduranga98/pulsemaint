import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { PartsRequest } from '@/types/inventory';

interface UsePartsRequestResult {
  request: PartsRequest | null;
  loading: boolean;
  error: string | null;
}

export function usePartsRequest(requestId: string | undefined): UsePartsRequestResult {
  const [request, setRequest] = useState<PartsRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!requestId) {
      setRequest(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const unsubscribe = onSnapshot(
      doc(db, 'partsRequests', requestId),
      (snap) => {
        if (snap.exists()) {
          setRequest({ id: snap.id, ...snap.data() } as PartsRequest);
        } else {
          setRequest(null);
        }
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [requestId]);

  return { request, loading, error };
}
