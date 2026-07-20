import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import type { TraineeProgramme } from '../../types/traineeProgram';

interface UseProgrammeByIdResult {
  programme: TraineeProgramme | null;
  loading: boolean;
}

export function useProgrammeById(programmeId: string | null): UseProgrammeByIdResult {
  const [programme, setProgramme] = useState<TraineeProgramme | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!programmeId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsub = onSnapshot(doc(db, 'traineeProgrammes', programmeId), (snap) => {
      setProgramme(snap.exists() ? ({ id: snap.id, ...snap.data() } as TraineeProgramme) : null);
      setLoading(false);
    });
    return () => unsub();
  }, [programmeId]);

  return { programme, loading };
}
