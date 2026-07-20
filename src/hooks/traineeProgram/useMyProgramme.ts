import { useEffect, useState } from 'react';
import { collection, limit, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuthStore } from '../../store/authStore';
import type { TraineeProgramme } from '../../types/traineeProgram';

interface UseMyProgrammeResult {
  programme: TraineeProgramme | null;
  loading: boolean;
  error: string | null;
}

/** Loads the current user's own active (or most recent) trainee programme. */
export function useMyProgramme(): UseMyProgrammeResult {
  const companyId = useAuthStore((s) => s.userProfile?.companyId);
  const userId = useAuthStore((s) => s.userProfile?.id);

  const [programme, setProgramme] = useState<TraineeProgramme | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId || !userId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const q = query(
      collection(db, 'traineeProgrammes'),
      where('traineeId', '==', userId),
      where('companyId', '==', companyId),
      limit(10),
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as TraineeProgramme));
        const active = docs.find((p) => p.status === 'active')
          ?? docs.sort((a, b) => (b.startDate?.toMillis?.() ?? 0) - (a.startDate?.toMillis?.() ?? 0))[0]
          ?? null;
        setProgramme(active);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );

    return () => unsub();
  }, [companyId, userId]);

  return { programme, loading, error };
}
