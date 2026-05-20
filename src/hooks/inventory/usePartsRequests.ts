import { useState, useEffect } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuthStore } from '@/store/authStore';
import type { PartsRequest, RequestStatus } from '@/types/inventory';

export interface UsePartsRequestsOptions {
  status?: RequestStatus | 'all';
  priorityLevel?: string;
  pageSize?: number;
}

interface UsePartsRequestsResult {
  requests: PartsRequest[];
  loading: boolean;
  error: string | null;
  totalCount: number;
}

const PRIORITY_ORDER: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export function usePartsRequests(options: UsePartsRequestsOptions = {}): UsePartsRequestsResult {
  const { status, priorityLevel, pageSize = 100 } = options;
  const companyId = useAuthStore((s) => s.userProfile?.companyId);

  const [requests, setRequests] = useState<PartsRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const constraints: Parameters<typeof query>[1][] = [
      where('companyId', '==', companyId),
    ];

    if (status && status !== 'all') {
      constraints.push(where('status', '==', status));
    }

    if (priorityLevel) {
      constraints.push(where('priorityLevel', '==', priorityLevel));
    }

    // Sort by urgency first, then by request time (oldest first = longest waiting)
    constraints.push(orderBy('isUrgent', 'desc'));
    constraints.push(orderBy('requestedAt', 'asc'));

    const q = query(collection(db, 'partsRequests'), ...constraints);

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        let docs = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as PartsRequest[];

        // Secondary client-side sort by priority level within urgency groups
        docs = docs.sort((a, b) => {
          if (a.isUrgent !== b.isUrgent) return a.isUrgent ? -1 : 1;
          const pa = PRIORITY_ORDER[a.priorityLevel] ?? 99;
          const pb = PRIORITY_ORDER[b.priorityLevel] ?? 99;
          if (pa !== pb) return pa - pb;
          // Oldest first (age-based)
          const ta = a.requestedAt?.toMillis?.() ?? 0;
          const tb = b.requestedAt?.toMillis?.() ?? 0;
          return ta - tb;
        });

        setRequests(docs.slice(0, pageSize));
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [companyId, status, priorityLevel, pageSize]);

  return { requests, loading, error, totalCount: requests.length };
}
