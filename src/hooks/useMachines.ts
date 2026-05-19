import { useState, useEffect } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  onSnapshot,
  Query,
  QueryConstraint,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Machine, MachineFilters } from '../types/machine';

const MACHINES_PER_PAGE = 20;

interface UseMachinesOptions {
  siteId: string;
  filters?: Partial<MachineFilters>;
  pageSize?: number;
}

interface UseMachinesResult {
  machines: Machine[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  loadMore: () => void;
  refresh: () => void;
  totalCount: number | null;
}

export function useMachines({
  siteId,
  filters = {},
  pageSize = MACHINES_PER_PAGE,
}: UseMachinesOptions): UseMachinesResult {
  const [machines, setMachines] = useState<Machine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [lastVisible, setLastVisible] = useState<Machine | null>(null);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [unsubscribe, setUnsubscribe] = useState<Unsubscribe | null>(null);

  useEffect(() => {
    if (!siteId) {
      setError('Site ID is required');
      return;
    }

    setMachines([]);
    setLastVisible(null);
    setHasMore(true);
    setLoading(true);

    const buildQuery = (): Query => {
      const constraints: QueryConstraint[] = [where('siteId', '==', siteId)];

      // Status filter
      if (filters.statuses && filters.statuses.length > 0) {
        constraints.push(where('status', 'in', filters.statuses));
      }

      // Criticality filter
      if (filters.criticalities && filters.criticalities.length > 0) {
        constraints.push(where('criticality', 'in', filters.criticalities));
      }

      // Health score range filter
      if (filters.healthScoreRange) {
        const [min, max] = filters.healthScoreRange;
        constraints.push(where('healthScore', '>=', min));
        constraints.push(where('healthScore', '<=', max));
      }

      constraints.push(orderBy('name', 'asc'));
      constraints.push(limit(pageSize + 1));

      return query(collection(db, 'machines'), ...constraints);
    };

    const q = buildQuery();

    try {
      const unsubscribeFn = onSnapshot(
        q,
        (snapshot) => {
          const fetchedMachines = snapshot.docs
            .slice(0, pageSize)
            .map((doc) => ({
              id: doc.id,
              ...doc.data(),
            })) as Machine[];

          setMachines(fetchedMachines);
          setHasMore(snapshot.docs.length > pageSize);

          if (fetchedMachines.length > 0) {
            setLastVisible(fetchedMachines[fetchedMachines.length - 1]);
          }

          setTotalCount(snapshot.docs.length);
          setLoading(false);
          setError(null);
        },
        (err) => {
          console.error('Error fetching machines:', err);
          setError(err.message || 'Failed to fetch machines');
          setLoading(false);
        }
      );

      setUnsubscribe(() => unsubscribeFn);

      return () => {
        unsubscribeFn();
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMsg);
      setLoading(false);
    }
  }, [siteId, filters, pageSize]);

  const loadMore = () => {
    if (!lastVisible || !hasMore || !siteId) return;

    const constraints: QueryConstraint[] = [where('siteId', '==', siteId)];

    if (filters.statuses && filters.statuses.length > 0) {
      constraints.push(where('status', 'in', filters.statuses));
    }

    if (filters.criticalities && filters.criticalities.length > 0) {
      constraints.push(where('criticality', 'in', filters.criticalities));
    }

    constraints.push(orderBy('name', 'asc'));
    constraints.push(startAfter(lastVisible));
    constraints.push(limit(pageSize + 1));

    const q = query(collection(db, 'machines'), ...constraints);

    onSnapshot(q, (snapshot) => {
      const newMachines = snapshot.docs
        .slice(0, pageSize)
        .map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Machine[];

      setMachines((prev) => [...prev, ...newMachines]);
      setHasMore(snapshot.docs.length > pageSize);

      if (newMachines.length > 0) {
        setLastVisible(newMachines[newMachines.length - 1]);
      }
    });
  };

  const refresh = () => {
    setMachines([]);
    setLastVisible(null);
    setHasMore(true);
    setLoading(true);
  };

  return {
    machines,
    loading,
    error,
    hasMore,
    loadMore,
    refresh,
    totalCount,
  };
}
