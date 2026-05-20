import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import type { TriageSession } from '../../types/triage';

export function useTriageSession(sessionId: string | undefined) {
  const [session, setSession] = useState<TriageSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsub = onSnapshot(
      doc(db, 'triageSessions', sessionId),
      (snap) => {
        if (snap.exists()) {
          setSession({ id: snap.id, ...snap.data() } as TriageSession);
        } else {
          setSession(null);
        }
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('useTriageSession error:', err);
        setError(err.message);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [sessionId]);

  return { session, loading, error };
}
