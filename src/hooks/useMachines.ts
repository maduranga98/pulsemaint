import { useState, useEffect, useMemo } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  onSnapshot,
  QueryDocumentSnapshot,
  DocumentData,
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
  filters,
  pageSize = MACHINES_PER_PAGE,
}: UseMachinesOptions): UseMachinesResult {
  const [machines, setMachines] = useState<Machine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [totalCount, setTotalCount] = useState<number | null>(null);

  const filtersKey = JSON.stringify(filters ?? {});
  const stableFilters = useMemo<Partial<MachineFilters>>(
    () => filters ?? {},
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filtersKey],
  );

  useEffect(() => {
    if (!siteId) {
      setError('Site ID is required');
      return;
    }

    setMachines([]);
    setLastDoc(null);
    setHasMore(true);
    setLoading(true);

    const q = query(
      collection(db, 'machines'),
      where('siteId', '==', siteId),
      orderBy('name', 'asc'),
      limit(pageSize + 1),
    );

    const unsubscribeFn = onSnapshot(
      q,
      (snapshot) => {
        const pageDocs = snapshot.docs.slice(0, pageSize);
        const fetchedMachines = pageDocs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Machine[];

        setMachines(fetchedMachines);
        setHasMore(snapshot.docs.length > pageSize);

        if (pageDocs.length > 0) {
          setLastDoc(pageDocs[pageDocs.length - 1]);
        }

        setTotalCount(snapshot.docs.length);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('Error fetching machines:', err);
        setError(err.message || 'Failed to fetch machines');
        setLoading(false);
      },
    );

    return () => {
      unsubscribeFn();
    };
  }, [siteId, pageSize]);

  const loadMore = () => {
    if (!lastDoc || !hasMore || !siteId) return;

    const q = query(
      collection(db, 'machines'),
      where('siteId', '==', siteId),
      orderBy('name', 'asc'),
      startAfter(lastDoc),
      limit(pageSize + 1),
    );

    onSnapshot(q, (snapshot) => {
      const pageDocs = snapshot.docs.slice(0, pageSize);
      const newMachines = pageDocs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Machine[];

      setMachines((prev) => [...prev, ...newMachines]);
      setHasMore(snapshot.docs.length > pageSize);

      if (pageDocs.length > 0) {
        setLastDoc(pageDocs[pageDocs.length - 1]);
      }
    });
  };

  const refresh = () => {
    setMachines([]);
    setLastDoc(null);
    setHasMore(true);
    setLoading(true);
  };

  // stableFilters is kept in scope so the return value is stable for callers
  void stableFilters;

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
