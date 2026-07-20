import { useEffect, useState } from 'react';
import { collection, collectionGroup, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuthStore } from '../../store/authStore';
import type { TrainingAssignment } from '../../lib/training/trainingTypes';

const PENDING_TRAINING_STATUSES = new Set([
  'not_started',
  'in_progress',
  'quiz_failed',
  'awaiting_practical',
]);

interface EvaluationRow {
  id: string;
  evaluateeName: string;
  evaluationDate: string;
}

interface AuditRow {
  id: string;
  templateName: string;
  auditDate: string;
  plantId: string;
}

// SUP-006: supervisor dashboard must surface the supervisor's own
// pending/assigned audits, evaluations, and trainings.
export function useAssignedTasks() {
  const companyId = useAuthStore((s) => s.userProfile?.companyId) ?? '';
  const userId = useAuthStore((s) => s.userProfile?.id) ?? '';

  const [trainings, setTrainings] = useState<TrainingAssignment[]>([]);
  const [evaluations, setEvaluations] = useState<EvaluationRow[]>([]);
  const [audits, setAudits] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!companyId || !userId) {
      setLoading(false);
      return;
    }

    let trainingsLoaded = false;
    let evaluationsLoaded = false;
    let auditsLoaded = false;
    const markLoaded = () => {
      if (trainingsLoaded && evaluationsLoaded && auditsLoaded) setLoading(false);
    };

    const trainingsQuery = query(
      collection(db, 'trainingAssignments'),
      where('traineeId', '==', userId),
      where('companyId', '==', companyId),
    );
    const unsubTrainings = onSnapshot(
      trainingsQuery,
      (snap) => {
        const data = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as TrainingAssignment)
          .filter((a) => PENDING_TRAINING_STATUSES.has(a.status));
        setTrainings(data);
        trainingsLoaded = true;
        markLoaded();
      },
      () => {
        trainingsLoaded = true;
        markLoaded();
      },
    );

    const evaluationsQuery = query(
      collection(db, 'evaluations'),
      where('evaluatorId', '==', userId),
      where('companyId', '==', companyId),
      where('status', '==', 'draft'),
    );
    const unsubEvaluations = onSnapshot(
      evaluationsQuery,
      (snap) => {
        setEvaluations(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as EvaluationRow));
        evaluationsLoaded = true;
        markLoaded();
      },
      () => {
        evaluationsLoaded = true;
        markLoaded();
      },
    );

    const auditsQuery = query(
      collectionGroup(db, 'sessions'),
      where('auditorId', '==', userId),
      where('status', '==', 'draft'),
    );
    const unsubAudits = onSnapshot(
      auditsQuery,
      (snap) => {
        const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as AuditRow);
        setAudits(data);
        auditsLoaded = true;
        markLoaded();
      },
      () => {
        auditsLoaded = true;
        markLoaded();
      },
    );

    return () => {
      unsubTrainings();
      unsubEvaluations();
      unsubAudits();
    };
  }, [companyId, userId]);

  return { trainings, evaluations, audits, loading };
}
