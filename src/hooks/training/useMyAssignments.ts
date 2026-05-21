import { useState, useEffect } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuthStore } from '@/store/authStore';
import type { TrainingAssignment, AssignmentStatus } from '@/lib/training/trainingTypes';

export interface UseMyAssignmentsOptions {
  status?: AssignmentStatus;
}

interface UseMyAssignmentsResult {
  assignments: TrainingAssignment[];
  loading: boolean;
  error: string | null;
}

export function useMyAssignments(
  options: UseMyAssignmentsOptions = {}
): UseMyAssignmentsResult {
  const { status } = options;
  const companyId = useAuthStore((s) => s.userProfile?.companyId);
  const userId = useAuthStore((s) => s.userProfile?.id);

  const [assignments, setAssignments] = useState<TrainingAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId || !userId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const q = query(
      collection(db, 'trainingAssignments'),
      where('traineeId', '==', userId),
      where('companyId', '==', companyId),
      orderBy('assignedAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        let docs = snap.docs.map(
          (d) => ({ id: d.id, ...d.data() }) as TrainingAssignment
        );
        if (status) {
          docs = docs.filter((a) => a.status === status);
        }
        setAssignments(docs);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [companyId, userId, status]);

  return { assignments, loading, error };
}
