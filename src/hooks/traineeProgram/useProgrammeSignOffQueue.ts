import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import type { TraineeProgramme } from '../../types/traineeProgram';
import type { TrainingAssignment } from '../../lib/training/trainingTypes';
import { isModuleDone } from '../../lib/training/programmeProgress';

interface UseProgrammeSignOffQueueResult {
  programmes: TraineeProgramme[];
  loading: boolean;
}

/**
 * Active trainee programmes whose every module has been completed and are
 * therefore waiting on an admin/plant manager/HR officer to write a
 * recommendation, sign, and issue the completion certificate — surfaced on
 * their dashboard instead of requiring them to check each trainee's profile
 * individually.
 */
export function useProgrammeSignOffQueue(companyId: string): UseProgrammeSignOffQueueResult {
  const [allActiveProgrammes, setAllActiveProgrammes] = useState<TraineeProgramme[]>([]);
  const [assignments, setAssignments] = useState<TrainingAssignment[]>([]);
  const [programmesLoaded, setProgrammesLoaded] = useState(false);
  const [assignmentsLoaded, setAssignmentsLoaded] = useState(false);

  useEffect(() => {
    if (!companyId) {
      setProgrammesLoaded(true);
      setAssignmentsLoaded(true);
      return;
    }

    const unsubProgrammes = onSnapshot(
      query(
        collection(db, 'traineeProgrammes'),
        where('companyId', '==', companyId),
        where('status', '==', 'active'),
      ),
      (snap) => {
        setAllActiveProgrammes(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as TraineeProgramme));
        setProgrammesLoaded(true);
      },
      (err) => {
        console.error('useProgrammeSignOffQueue: programmes', err.message);
        setProgrammesLoaded(true);
      },
    );

    const unsubAssignments = onSnapshot(
      query(collection(db, 'trainingAssignments'), where('companyId', '==', companyId)),
      (snap) => {
        setAssignments(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as TrainingAssignment));
        setAssignmentsLoaded(true);
      },
      (err) => {
        console.error('useProgrammeSignOffQueue: assignments', err.message);
        setAssignmentsLoaded(true);
      },
    );

    return () => {
      unsubProgrammes();
      unsubAssignments();
    };
  }, [companyId]);

  const programmes = useMemo(() => {
    return allActiveProgrammes.filter((p) => {
      const allModuleIds = p.months.flatMap((m) => m.moduleIds);
      if (allModuleIds.length === 0) return false;
      return allModuleIds.every((id) => isModuleDone(assignments, p.traineeId, id));
    });
  }, [allActiveProgrammes, assignments]);

  return { programmes, loading: !programmesLoaded || !assignmentsLoaded };
}
