import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuthStore } from '@/store/authStore';
import type { TrainingAssignment } from '@/lib/training/trainingTypes';

interface UseTrainingSignOffQueueResult {
  assignments: TrainingAssignment[];
  loading: boolean;
}

/**
 * Completed trainings waiting on a practical sign-off, company-wide.
 *
 * A learner reaches `awaiting_practical` by passing the module's final test;
 * a supervisor / plant manager / admin then observes the practical and
 * certifies (or fails) them. These used to be reachable only by opening each
 * trainee's profile, so they now sit alongside completed work orders in the
 * Sign-Off Queue.
 */
export function useTrainingSignOffQueue(): UseTrainingSignOffQueueResult {
  const companyId = useAuthStore((s) => s.userProfile?.companyId);
  const [assignments, setAssignments] = useState<TrainingAssignment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsub = onSnapshot(
      query(
        collection(db, 'trainingAssignments'),
        where('companyId', '==', companyId),
        where('status', '==', 'awaiting_practical')
      ),
      (snap) => {
        setAssignments(
          snap.docs
            .map((d) => ({ id: d.id, ...d.data() }) as TrainingAssignment)
            .sort(
              (a, b) =>
                ((b.quizPassedAt as any)?.toMillis?.() ?? 0) - ((a.quizPassedAt as any)?.toMillis?.() ?? 0)
            )
        );
        setLoading(false);
      },
      () => setLoading(false)
    );
    return () => unsub();
  }, [companyId]);

  return { assignments, loading };
}
