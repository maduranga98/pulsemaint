import { useState, useEffect } from 'react';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuthStore } from '../../store/authStore';
import type { TriageFlow } from '../../types/triage';

export function useTriageFlowLibrary() {
  const [flows, setFlows] = useState<TriageFlow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const companyId = useAuthStore((s) => s.userProfile?.companyId);

  useEffect(() => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const q = query(
      collection(db, 'triageFlows'),
      where('companyId', '==', companyId),
      where('isActive', '==', true),
      orderBy('updatedAt', 'desc')
    );
    getDocs(q)
      .then((snap) => {
        setFlows(snap.docs.map((d) => ({ id: d.id, ...d.data() } as TriageFlow)));
        setLoading(false);
      })
      .catch((err) => {
        console.error('useTriageFlowLibrary error:', err);
        setError(err.message);
        setLoading(false);
      });
  }, [companyId]);

  return { flows, loading, error };
}
