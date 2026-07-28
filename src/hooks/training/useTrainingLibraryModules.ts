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
import type {
  TrainingLibraryModule,
  TrainingModuleStatus,
} from '@/lib/training/trainingTypes';

export interface UseTrainingLibraryModulesOptions {
  status?: TrainingModuleStatus;
  searchQuery?: string;
}

interface UseTrainingLibraryModulesResult {
  modules: TrainingLibraryModule[];
  loading: boolean;
  error: string | null;
}

/**
 * The Training tab's module library — machine/competency modules only.
 *
 * Owns its own query: `libraryScope == 'training'` is a server-side filter,
 * so Trainee Management's programme modules never reach this hook, and no
 * caller can widen it by passing a scope. Trainee Management has its own
 * hook (`useTraineeLibraryModules`); the two never share a query.
 *
 * Requires the composite indexes companyId+libraryScope and
 * companyId+libraryScope+status (see firestore.indexes.json).
 */
export function useTrainingLibraryModules(
  options: UseTrainingLibraryModulesOptions = {}
): UseTrainingLibraryModulesResult {
  const { status, searchQuery } = options;
  const companyId = useAuthStore((s) => s.userProfile?.companyId);

  const [modules, setModules] = useState<TrainingLibraryModule[]>([]);
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
      where('libraryScope', '==', 'training'),
    ];
    if (status) constraints.push(where('status', '==', status));

    // Sorted client-side: an orderBy(updatedAt) on top of these equality
    // filters would need yet another composite index per filter combination.
    const q = query(collection(db, 'trainingModules'), ...constraints);

    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        let docs = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as TrainingLibraryModule)
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
  }, [companyId, status, searchQuery]);

  return { modules, loading, error };
}
