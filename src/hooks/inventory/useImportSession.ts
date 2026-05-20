import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { InventoryImportSession } from '@/types/inventory';

interface UseImportSessionResult {
  session: InventoryImportSession | null;
  loading: boolean;
  error: string | null;
}

export function useImportSession(sessionId: string | null): UseImportSessionResult {
  const [session, setSession] = useState<InventoryImportSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) {
      setSession(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const unsubscribe = onSnapshot(
      doc(db, 'inventoryImportSessions', sessionId),
      (snap) => {
        if (snap.exists()) {
          setSession({ id: snap.id, ...snap.data() } as InventoryImportSession);
        } else {
          setSession(null);
        }
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [sessionId]);

  return { session, loading, error };
}
