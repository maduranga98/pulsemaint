import { useState, useEffect } from 'react';
import { collection, query, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import type { TriageFlow } from '../../types/triage';

export function useTriageTemplates() {
  const [templates, setTemplates] = useState<TriageFlow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, 'triageTemplates'));
    getDocs(q)
      .then((snap) => {
        setTemplates(snap.docs.map((d) => ({ id: d.id, ...d.data() } as TriageFlow)));
        setLoading(false);
      })
      .catch((err) => {
        console.error('useTriageTemplates error:', err);
        setError(err.message);
        setLoading(false);
      });
  }, []);

  return { templates, loading, error };
}
