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
import type { InventoryImportSession } from '@/types/inventory';

interface UseImportHistoryResult {
  sessions: InventoryImportSession[];
  loading: boolean;
  error: string | null;
}

export function useImportHistory(): UseImportHistoryResult {
  const companyId = useAuthStore((s) => s.userProfile?.companyId);
  const userId = useAuthStore((s) => s.userProfile?.id);
  const isStoreKeeper = useAuthStore((s) => s.isStoreKeeper);

  const [sessions, setSessions] = useState<InventoryImportSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId || !userId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const constraints: Parameters<typeof query>[1][] = [
      where('companyId', '==', companyId),
    ];

    // Store Keepers see only their own imports; Supervisors/Managers see all
    if (isStoreKeeper) {
      constraints.push(where('importedBy', '==', userId));
    }

    constraints.push(orderBy('startedAt', 'desc'));

    const q = query(collection(db, 'inventoryImportSessions'), ...constraints);

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const docs = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as InventoryImportSession[];
        setSessions(docs);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [companyId, userId, isStoreKeeper]);

  return { sessions, loading, error };
}
