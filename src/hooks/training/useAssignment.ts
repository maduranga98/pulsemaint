import { useState, useEffect } from 'react';
import { doc, onSnapshot, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { TrainingAssignment, TrainingModule } from '@/lib/training/trainingTypes';

interface UseAssignmentResult {
  assignment: TrainingAssignment | null;
  module: TrainingModule | null;
  loading: boolean;
  error: string | null;
}

export function useAssignment(assignmentId: string): UseAssignmentResult {
  const [assignment, setAssignment] = useState<TrainingAssignment | null>(null);
  const [module, setModule] = useState<TrainingModule | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!assignmentId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const assignmentRef = doc(db, 'trainingAssignments', assignmentId);

    const unsubscribe = onSnapshot(
      assignmentRef,
      async (snap) => {
        if (!snap.exists()) {
          setAssignment(null);
          setModule(null);
          setLoading(false);
          return;
        }

        const assignmentData = { id: snap.id, ...snap.data() } as TrainingAssignment;
        setAssignment(assignmentData);

        try {
          const moduleSnap = await getDoc(
            doc(db, 'trainingModules', assignmentData.moduleId)
          );
          if (moduleSnap.exists()) {
            setModule({ id: moduleSnap.id, ...moduleSnap.data() } as TrainingModule);
          } else {
            setModule(null);
          }
        } catch (moduleErr) {
          setError(
            moduleErr instanceof Error ? moduleErr.message : 'Failed to load module'
          );
        }

        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [assignmentId]);

  return { assignment, module, loading, error };
}
