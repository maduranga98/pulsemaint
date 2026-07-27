import { useState, useEffect } from 'react';
import {
  collection,
  query,
  where,
  onSnapshot,
  QueryConstraint,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuthStore } from '@/store/authStore';
import type { TrainingModule, TrainingModuleStatus, ModuleCategory } from '@/lib/training/trainingTypes';

export interface UseTrainingModulesOptions {
  status?: TrainingModuleStatus;
  moduleCategory?: ModuleCategory;
  searchQuery?: string;
}

interface UseTrainingModulesResult {
  modules: TrainingModule[];
  loading: boolean;
  error: string | null;
}

export function useTrainingModules(
  options: UseTrainingModulesOptions = {}
): UseTrainingModulesResult {
  const { status, moduleCategory, searchQuery } = options;
  const companyId = useAuthStore((s) => s.userProfile?.companyId);

  const [modules, setModules] = useState<TrainingModule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const constraints: QueryConstraint[] = [
      where('companyId', '==', companyId),
    ];

    if (status) {
      constraints.push(where('status', '==', status));
    }

    if (moduleCategory) {
      constraints.push(where('moduleCategory', '==', moduleCategory));
    }

    // Sorted client-side: companyId + orderBy(updatedAt) without a status
    // filter has no composite index deployed and would fail silently.
    const q = query(collection(db, 'trainingModules'), ...constraints);

    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        let docs = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as TrainingModule)
          .sort(
            (a, b) =>
              ((b.updatedAt as any)?.toMillis?.() ?? 0) -
              ((a.updatedAt as any)?.toMillis?.() ?? 0)
          );

        if (searchQuery && searchQuery.trim() !== '') {
          const term = searchQuery.trim().toLowerCase();
          docs = docs.filter(
            (m) =>
              (m.title ?? '').toLowerCase().includes(term) ||
              (m.machineName ?? '').toLowerCase().includes(term) ||
              (m.tags ?? []).some((tag) => tag.toLowerCase().includes(term))
          );
        }

        setModules(docs);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [companyId, status, moduleCategory, searchQuery]);

  return { modules, loading, error };
}
