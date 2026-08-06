import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuthStore } from '@/store/authStore';
import type { TrainingProgram } from '@/types/trainingProgram';

export function useTrainingPrograms(): { programs: TrainingProgram[]; loading: boolean } {
  const companyId = useAuthStore((s) => s.userProfile?.companyId);
  const [programs, setPrograms] = useState<TrainingProgram[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsub = onSnapshot(
      query(collection(db, 'trainingPrograms'), where('companyId', '==', companyId)),
      (snap) => {
        setPrograms(
          snap.docs
            .map((d) => ({ id: d.id, ...d.data() }) as TrainingProgram)
            .sort((a, b) => ((b.createdAt as any)?.toMillis?.() ?? 0) - ((a.createdAt as any)?.toMillis?.() ?? 0))
        );
        setLoading(false);
      },
      () => setLoading(false)
    );
    return () => unsub();
  }, [companyId]);

  return { programs, loading };
}
