import { useState, useEffect, useMemo } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuthStore } from '@/store/authStore';
import type { PartReturn, PartReturnStatus } from '@/types/inventory';
import { usePlantFilter } from '@/hooks/usePlantFilter';
import { usePlantPartIds } from '@/hooks/usePlantPartIds';

export interface UsePartReturnsOptions {
  status?: PartReturnStatus | 'all';
  // Scope to only the current user's own return requests (requester view).
  ownOnly?: boolean;
}

interface UsePartReturnsResult {
  returns: PartReturn[];
  loading: boolean;
  error: string | null;
}

export function usePartReturns(options: UsePartReturnsOptions = {}): UsePartReturnsResult {
  const { status, ownOnly } = options;
  const companyId = useAuthStore((s) => s.userProfile?.companyId);
  const userId = useAuthStore((s) => s.userProfile?.id);

  const [allReturns, setReturns] = useState<PartReturn[]>([]);
  // Own plant only (admin: selected plant tab): the returned part's plant,
  // falling back to the requester's plant.
  const { inPlant, isPlantScoped } = usePlantFilter(companyId);
  const plantPartIds = usePlantPartIds(companyId);
  const returns = useMemo(
    () =>
      isPlantScoped
        ? allReturns.filter((r) => plantPartIds?.has(r.partId) || inPlant(null, r.requestedBy))
        : allReturns,
    [allReturns, isPlantScoped, plantPartIds, inPlant],
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId || (ownOnly && !userId)) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const constraints: Parameters<typeof query>[1][] = [where('companyId', '==', companyId)];
    if (ownOnly && userId) {
      constraints.push(where('requestedBy', '==', userId));
    }
    if (status && status !== 'all') {
      constraints.push(where('status', '==', status));
    }

    const q = query(collection(db, 'partReturns'), ...constraints);

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const docs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as PartReturn[];
        docs.sort((a, b) => (b.requestedAt?.toMillis?.() ?? 0) - (a.requestedAt?.toMillis?.() ?? 0));
        setReturns(docs);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [companyId, userId, ownOnly, status]);

  return { returns, loading, error };
}
