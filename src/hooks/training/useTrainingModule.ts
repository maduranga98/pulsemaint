import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { TrainingModule } from '@/lib/training/trainingTypes';

interface UseTrainingModuleResult {
  module: TrainingModule | null;
  loading: boolean;
  error: string | null;
}

export function useTrainingModule(moduleId: string): UseTrainingModuleResult {
  const [module, setModule] = useState<TrainingModule | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!moduleId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const unsubscribe = onSnapshot(
      doc(db, 'trainingModules', moduleId),
      (snap) => {
        if (snap.exists()) {
          setModule({ id: snap.id, ...snap.data() } as TrainingModule);
        } else {
          setModule(null);
        }
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [moduleId]);

  return { module, loading, error };
}
