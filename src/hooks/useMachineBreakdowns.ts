import { useEffect, useState, useCallback } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  getDocs,
  type QueryDocumentSnapshot,
  type DocumentData,
} from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface BreakdownHistoryItem {
  id: string;
  ticketNumber: string;
  reportedAt: any;
  severity: string;
  type: string;
  description: string;
  status: string;
  attemptedFixes: string;
  resolvedAt: any;
  assignedTechnicianNames: string[];
}

const PAGE_SIZE = 20;

export function useMachineBreakdowns(machineId: string | null | undefined) {
  const [entries, setEntries] = useState<BreakdownHistoryItem[]>([]);
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
          collection(db, 'breakdown_tickets'),
          where('machineId', '==', machineId),
          orderBy('reportedAt', 'desc'),
          limit(PAGE_SIZE),
        );
        if (cursor) q = query(q, startAfter(cursor));

        const snap = await getDocs(q);
        const items = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            ticketNumber: data.ticketNumber ?? '',
            reportedAt: data.reportedAt,
            severity: data.severity ?? '',
            type: data.type ?? '',
            description: data.description ?? '',
            status: data.status ?? '',
            attemptedFixes: data.attemptedFixes ?? '',
            resolvedAt: data.resolvedAt,
            assignedTechnicianNames: data.assignedTechnicianNames ?? [],
          } as BreakdownHistoryItem;
        });

        setEntries((prev) => (cursor ? [...prev, ...items] : items));
        setLastDoc(snap.docs[snap.docs.length - 1] ?? null);
        setHasMore(snap.size === PAGE_SIZE);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load breakdown history');
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
