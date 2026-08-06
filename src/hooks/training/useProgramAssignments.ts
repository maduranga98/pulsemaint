import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuthStore } from '@/store/authStore';
import type { ProgramAssignment } from '@/types/trainingProgram';
import type { TrainingAssignment } from '@/lib/training/trainingTypes';

interface UseProgramAssignmentsResult {
  programAssignments: ProgramAssignment[];
  moduleAssignmentsById: Map<string, TrainingAssignment>;
  loading: boolean;
}

/**
 * Live program-assignment docs plus every underlying module-level
 * trainingAssignments doc (company-wide), so progress/completion for each
 * program assignment can be derived from its moduleAssignmentIds.
 */
export function useProgramAssignments(): UseProgramAssignmentsResult {
  const companyId = useAuthStore((s) => s.userProfile?.companyId);
  const [programAssignments, setProgramAssignments] = useState<ProgramAssignment[]>([]);
  const [moduleAssignments, setModuleAssignments] = useState<TrainingAssignment[]>([]);
  const [paLoading, setPaLoading] = useState(true);
  const [maLoading, setMaLoading] = useState(true);

  useEffect(() => {
    if (!companyId) {
      setPaLoading(false);
      return;
    }
    setPaLoading(true);
    const unsub = onSnapshot(
      query(collection(db, 'programAssignments'), where('companyId', '==', companyId)),
      (snap) => {
        setProgramAssignments(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ProgramAssignment));
        setPaLoading(false);
      },
      () => setPaLoading(false)
    );
    return () => unsub();
  }, [companyId]);

  useEffect(() => {
    if (!companyId) {
      setMaLoading(false);
      return;
    }
    setMaLoading(true);
    const unsub = onSnapshot(
      query(collection(db, 'trainingAssignments'), where('companyId', '==', companyId)),
      (snap) => {
        setModuleAssignments(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as TrainingAssignment));
        setMaLoading(false);
      },
      () => setMaLoading(false)
    );
    return () => unsub();
  }, [companyId]);

  const moduleAssignmentsById = new Map(moduleAssignments.map((a) => [a.id, a]));

  return { programAssignments, moduleAssignmentsById, loading: paLoading || maLoading };
}
