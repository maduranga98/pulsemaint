import { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import type { TriageFlow } from '../../types/triage';

export function useTriageFlow(flowId: string | undefined) {
  const [flow, setFlow] = useState<TriageFlow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!flowId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    getDoc(doc(db, 'triageFlows', flowId))
      .then((snap) => {
        if (snap.exists()) {
          setFlow({ id: snap.id, ...snap.data() } as TriageFlow);
        } else {
          setFlow(null);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error('useTriageFlow error:', err);
        setError(err.message);
        setLoading(false);
      });
  }, [flowId]);

  return { flow, loading, error };
}
