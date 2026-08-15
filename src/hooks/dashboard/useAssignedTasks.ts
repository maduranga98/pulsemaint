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

export interface AssignedSafetyCaseRow {
  id: string;
  title: string;
  severity: string;
  status: string;
}

export interface AssignedWoRow {
  id: string;
  woNumber: string;
  machineName: string;
  woType: string;
  status: string;
}

const OPEN_WO_STATUSES = ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'ON_HOLD_PARTS', 'ON_HOLD_APPROVAL'];

// SUP-006: supervisor dashboard must surface the supervisor's own
// pending/assigned audits, evaluations, and trainings.
export function useAssignedTasks() {
  const companyId = useAuthStore((s) => s.userProfile?.companyId) ?? '';
  const userId = useAuthStore((s) => s.userProfile?.id) ?? '';

  const [trainings, setTrainings] = useState<TrainingAssignment[]>([]);
  const [evaluations, setEvaluations] = useState<EvaluationRow[]>([]);
  const [audits, setAudits] = useState<AuditRow[]>([]);
  const [workOrders, setWorkOrders] = useState<AssignedWoRow[]>([]);
  const [safetyCases, setSafetyCases] = useState<AssignedSafetyCaseRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!companyId || !userId) {
      setLoading(false);
      return;
    }

    let trainingsLoaded = false;
    let evaluationsLoaded = false;
    let auditsLoaded = false;
    let wosLoaded = false;
    let safetyCasesLoaded = false;
    const markLoaded = () => {
      if (trainingsLoaded && evaluationsLoaded && auditsLoaded && wosLoaded && safetyCasesLoaded) setLoading(false);
    };

    // Work orders assigned to this user (as technician-in-charge or the WO's
    // supervisor), open only. Two listeners merged, deduped by id.
    const woAssigned: Record<string, AssignedWoRow> = {};
    const woSupervised: Record<string, AssignedWoRow> = {};
    const pushWos = () => {
      const merged = new Map<string, AssignedWoRow>();
      [...Object.values(woAssigned), ...Object.values(woSupervised)].forEach((w) => merged.set(w.id, w));
      setWorkOrders([...merged.values()].filter((w) => OPEN_WO_STATUSES.includes(w.status)));
    };
    const toWoRow = (id: string, d: Record<string, unknown>): AssignedWoRow => ({
      id,
      woNumber: String(d.woNumber ?? ''),
      machineName: String(d.machineName ?? ''),
      woType: String(d.woType ?? ''),
      status: String(d.status ?? ''),
    });
    const unsubWoAssigned = onSnapshot(
      query(collection(db, 'workOrders'), where('companyId', '==', companyId), where('assignedTechnicianIds', 'array-contains', userId)),
      (snap) => {
        for (const k of Object.keys(woAssigned)) delete woAssigned[k];
        snap.docs.forEach((d) => { woAssigned[d.id] = toWoRow(d.id, d.data()); });
        pushWos(); wosLoaded = true; markLoaded();
      },
      () => { wosLoaded = true; markLoaded(); },
    );
    const unsubWoSup = onSnapshot(
      query(collection(db, 'workOrders'), where('companyId', '==', companyId), where('supervisorInChargeId', '==', userId)),
      (snap) => {
        for (const k of Object.keys(woSupervised)) delete woSupervised[k];
        snap.docs.forEach((d) => { woSupervised[d.id] = toWoRow(d.id, d.data()); });
        pushWos();
      },
      () => {},
    );

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

    // Safety cases escalated ("reported to") this user specifically — never
    // the whole company's cases, only the ones that regard them.
    const safetyCasesQuery = query(
      collection(db, 'safety_cases'),
      where('companyId', '==', companyId),
      where('reportedToUserId', '==', userId),
      where('status', '!=', 'closed'),
    );
    const unsubSafetyCases = onSnapshot(
      safetyCasesQuery,
      (snap) => {
        setSafetyCases(snap.docs.map((d) => {
          const data = d.data();
          return { id: d.id, title: String(data.title ?? ''), severity: String(data.severity ?? ''), status: String(data.status ?? '') };
        }));
        safetyCasesLoaded = true;
        markLoaded();
      },
      () => {
        safetyCasesLoaded = true;
        markLoaded();
      },
    );

    return () => {
      unsubTrainings();
      unsubEvaluations();
      unsubAudits();
      unsubWoAssigned();
      unsubWoSup();
      unsubSafetyCases();
    };
  }, [companyId, userId]);

  return { trainings, evaluations, audits, workOrders, safetyCases, loading };
}
