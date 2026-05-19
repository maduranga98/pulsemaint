import { useEffect, useState, useCallback } from 'react';
import {
  collection,
  query,
  orderBy,
  limit,
  startAfter,
  getDocs,
  type QueryDocumentSnapshot,
  type DocumentData,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { MachineHistoryEntry } from '../types/workOrder';

const PAGE_SIZE = 20;

interface UseMachineHistoryResult {
  entries: MachineHistoryEntry[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  loadMore: () => void;
}

export function useMachineHistory(machineId: string | null | undefined): UseMachineHistoryResult {
  const [entries, setEntries] = useState<MachineHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMore, setHasMore] = useState(true);

  const fetchPage = useCallback(
    async (cursor: QueryDocumentSnapshot<DocumentData> | null) => {
      if (!machineId) return;
      setLoading(true);
      setError(null);

      try {
        let q = query(
          collection(db, 'machineHistory', machineId, 'entries'),
          orderBy('date', 'desc'),
          limit(PAGE_SIZE),
        );
        if (cursor) q = query(q, startAfter(cursor));

        const snap = await getDocs(q);
        const newEntries = snap.docs.map((d) => ({ id: d.id, ...d.data() } as MachineHistoryEntry));

        setEntries((prev) => (cursor ? [...prev, ...newEntries] : newEntries));
        setLastDoc(snap.docs[snap.docs.length - 1] ?? null);
        setHasMore(snap.size === PAGE_SIZE);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load machine history');
      } finally {
        setLoading(false);
      }
    },
    [machineId],
  );

  useEffect(() => {
    setEntries([]);
    setLastDoc(null);
    setHasMore(true);
    fetchPage(null);
  }, [machineId, fetchPage]);

  const loadMore = useCallback(() => {
    if (!loading && hasMore) fetchPage(lastDoc);
  }, [loading, hasMore, lastDoc, fetchPage]);

  return { entries, loading, error, hasMore, loadMore };
}
