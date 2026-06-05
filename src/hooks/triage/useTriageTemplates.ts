import { useState, useEffect } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuthStore } from '../../store/authStore';
import { BUILTIN_TRIAGE_TEMPLATES } from '../../lib/triage/builtinTemplates';
import type { TriageFlow } from '../../types/triage';

export function useTriageTemplates() {
  const [templates, setTemplates] = useState<TriageFlow[]>(BUILTIN_TRIAGE_TEMPLATES);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const companyId = useAuthStore((s) => s.userProfile?.companyId);

  useEffect(() => {
    setLoading(true);

    // User-created templates are saved as triageFlows with isTemplate=true
    // by TriageFlowEditor. Also try the legacy 'triageTemplates' collection
    // for any pre-existing data.
    const fetchUserTemplates = async (): Promise<TriageFlow[]> => {
      if (!companyId) return [];
      const results: TriageFlow[] = [];
      try {
        const flowSnap = await getDocs(
          query(
            collection(db, 'triageFlows'),
            where('companyId', '==', companyId),
            where('isTemplate', '==', true),
          ),
        );
        flowSnap.forEach((d) => results.push({ id: d.id, ...d.data() } as TriageFlow));
      } catch (err) {
        console.warn('triageFlows template query failed', err);
      }
      try {
        const legacySnap = await getDocs(collection(db, 'triageTemplates'));
        legacySnap.forEach((d) => {
          const data = d.data() as TriageFlow & { companyId?: string };
          if (!data.companyId || data.companyId === companyId) {
            results.push({ ...data, id: d.id } as TriageFlow);
          }
        });
      } catch {
        // legacy collection may not exist; ignore.
      }
      return results;
    };

    fetchUserTemplates()
      .then((remote) => {
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
        setTemplates(BUILTIN_TRIAGE_TEMPLATES);
        setLoading(false);
      });
  }, [companyId]);

  return { templates, loading, error };
}
