import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import type { TrainingAssignment } from '../../lib/training/trainingTypes';

export interface OngoingTrainingRow {
  id: string;
  traineeName: string;
  traineeRole: string;
  moduleName: string;
  overallProgress: number;
}

const ONGOING_STATUSES = new Set(['not_started', 'in_progress', 'quiz_failed', 'awaiting_practical']);

// Every training assignment currently in flight, company-wide — who's doing
// it, what role they're in, and how far along they are — for HR's Analytics
// tab (previously only visible one trainee at a time via their profile).
export function useOngoingTrainings(companyId: string) {
  const [trainings, setTrainings] = useState<OngoingTrainingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsub = onSnapshot(
      query(collection(db, 'trainingAssignments'), where('companyId', '==', companyId)),
      (snap) => {
        const rows = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as TrainingAssignment)
          .filter((a) => ONGOING_STATUSES.has(a.status))
          .map((a) => ({
            id: a.id,
            traineeName: a.traineeName,
            traineeRole: a.traineeRole ?? '',
            moduleName: a.moduleName,
            overallProgress: a.overallProgress ?? 0,
          }))
          .sort((a, b) => b.overallProgress - a.overallProgress);
        setTrainings(rows);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );
    return () => unsub();
  }, [companyId]);

  return { trainings, loading, error };
}
