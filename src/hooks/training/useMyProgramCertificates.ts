import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuthStore } from '@/store/authStore';
import type { ProgramAssignment } from '@/types/trainingProgram';

interface UseMyProgramCertificatesResult {
  certificates: ProgramAssignment[];
  loading: boolean;
}

/** The signed-in trainee's own signed-off program assignments — each one has a downloadable certificate. */
export function useMyProgramCertificates(): UseMyProgramCertificatesResult {
  const companyId = useAuthStore((s) => s.userProfile?.companyId);
  const userId = useAuthStore((s) => s.userProfile?.id);
  const [certificates, setCertificates] = useState<ProgramAssignment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!companyId || !userId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const q = query(
      collection(db, 'programAssignments'),
      where('companyId', '==', companyId),
      where('traineeId', '==', userId),
      where('status', '==', 'signed_off'),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setCertificates(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ProgramAssignment));
        setLoading(false);
      },
      () => setLoading(false),
    );
    return () => unsub();
  }, [companyId, userId]);

  return { certificates, loading };
}
