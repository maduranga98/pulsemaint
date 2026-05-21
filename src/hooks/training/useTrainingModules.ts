import { useState, useEffect } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  QueryConstraint,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuthStore } from '@/store/authStore';
import type { TrainingModule, TrainingModuleStatus } from '@/lib/training/trainingTypes';

export interface UseTrainingModulesOptions {
  status?: TrainingModuleStatus;
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
  const { status, searchQuery } = options;
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

    constraints.push(orderBy('updatedAt', 'desc'));

    const q = query(collection(db, 'trainingModules'), ...constraints);

    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        let docs = snap.docs.map(
          (d) => ({ id: d.id, ...d.data() }) as TrainingModule
        );

        if (searchQuery && searchQuery.trim() !== '') {
          const term = searchQuery.trim().toLowerCase();
          docs = docs.filter(
            (m) =>
              m.title.toLowerCase().includes(term) ||
              m.machineName.toLowerCase().includes(term) ||
              m.tags.some((tag) => tag.toLowerCase().includes(term))
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
