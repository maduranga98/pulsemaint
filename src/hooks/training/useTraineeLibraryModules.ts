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
  TraineeLibraryModule,
  TraineeTrainingType,
  TrainingModuleStatus,
} from '@/lib/training/trainingTypes';

export interface UseTraineeLibraryModulesOptions {
  status?: TrainingModuleStatus;
  trainingType?: TraineeTrainingType;
  searchQuery?: string;
}

interface UseTraineeLibraryModulesResult {
  modules: TraineeLibraryModule[];
  loading: boolean;
  error: string | null;
}

/**
 * Trainee Management's module library — programme modules only.
 *
 * Owns its own query: `libraryScope == 'trainee_management'` is a
 * server-side filter, so the Training tab's machine/competency modules are
 * never returned here and can never be assigned through the trainee-first
 * flow. The Training tab has its own hook (`useTrainingLibraryModules`).
 *
 * Requires the composite indexes companyId+libraryScope and
 * companyId+libraryScope+status (see firestore.indexes.json).
 */
export function useTraineeLibraryModules(
  options: UseTraineeLibraryModulesOptions = {}
): UseTraineeLibraryModulesResult {
  const { status, trainingType, searchQuery } = options;
  const companyId = useAuthStore((s) => s.userProfile?.companyId);

  const [modules, setModules] = useState<TraineeLibraryModule[]>([]);
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
      where('libraryScope', '==', 'trainee_management'),
    ];
    if (status) constraints.push(where('status', '==', status));

    // trainingType is filtered client-side: adding it to the query would
    // need a further composite index per combination, and the trainee
    // library is small enough that the snapshot is cheap to filter.
    const q = query(collection(db, 'trainingModules'), ...constraints);

    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        let docs = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as TraineeLibraryModule)
          .sort(
            (a, b) =>
              ((b.updatedAt as any)?.toMillis?.() ?? 0) -
              ((a.updatedAt as any)?.toMillis?.() ?? 0)
          );

        if (trainingType) {
          docs = docs.filter((m) => m.trainingType === trainingType);
        }

        if (searchQuery && searchQuery.trim() !== '') {
          const term = searchQuery.trim().toLowerCase();
          docs = docs.filter(
            (m) =>
              (m.title ?? '').toLowerCase().includes(term) ||
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
  }, [companyId, status, trainingType, searchQuery]);

  return { modules, loading, error };
}
