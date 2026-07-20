import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import type { WeekendSummary } from '../../types/traineeProgram';

interface UseWeekendSummariesResult {
  summaries: WeekendSummary[];
  loading: boolean;
  error: string | null;
}

export function useWeekendSummaries(programmeId: string | null): UseWeekendSummariesResult {
  const [summaries, setSummaries] = useState<WeekendSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!programmeId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const q = query(
      collection(db, 'weekendSummaries'),
      where('programmeId', '==', programmeId),
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const docs = snap.docs
          .map((d) => ({ id: d.id, ...d.data() } as WeekendSummary))
          .sort((a, b) => (b.weekEndingDate > a.weekEndingDate ? 1 : -1));
        setSummaries(docs);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );

    return () => unsub();
  }, [programmeId]);

  return { summaries, loading, error };
}
