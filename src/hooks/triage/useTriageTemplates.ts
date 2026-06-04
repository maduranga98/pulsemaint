import { useState, useEffect } from 'react';
import { collection, query, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { BUILTIN_TRIAGE_TEMPLATES } from '../../lib/triage/builtinTemplates';
import type { TriageFlow } from '../../types/triage';

export function useTriageTemplates() {
  const [templates, setTemplates] = useState<TriageFlow[]>(BUILTIN_TRIAGE_TEMPLATES);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, 'triageTemplates'));
    getDocs(q)
      .then((snap) => {
        const remote = snap.docs.map((d) => ({ id: d.id, ...d.data() } as TriageFlow));
        // Merge: built-in templates always available, deduped by name so a
        // company can override a built-in with their own template.
        const remoteNames = new Set(remote.map((t) => t.name));
        const merged = [
          ...remote,
          ...BUILTIN_TRIAGE_TEMPLATES.filter((t) => !remoteNames.has(t.name)),
        ];
        setTemplates(merged);
        setLoading(false);
      })
      .catch((err) => {
        console.error('useTriageTemplates error:', err);
        setError(err.message);
        // Keep built-in templates visible on failure.
        setTemplates(BUILTIN_TRIAGE_TEMPLATES);
        setLoading(false);
      });
  }, []);

  return { templates, loading, error };
}
