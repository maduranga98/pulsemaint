import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
  serverTimestamp,
  orderBy,
  limit,
} from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import type {
  AMTask,
  AMTaskStatus,
  TPMMaturityLevel,
  TPMMonthlyScore,
  TPMPillarId,
  TPMMachineScore,
} from '../types/tpm.types';
import { PILLAR_WEIGHTS, PILLAR_META } from '../types/tpm.types';

// ─── Score Calculation ────────────────────────────────────────────────────────

export function calculateTPMScore(pillarScores: Partial<Record<TPMPillarId, number>>): number {
  const pillarIds = Object.keys(PILLAR_WEIGHTS) as TPMPillarId[];
  let weighted = 0;
  let totalWeight = 0;

  for (const id of pillarIds) {
    const score = pillarScores[id];
    if (score !== undefined) {
      weighted += score * PILLAR_WEIGHTS[id];
      totalWeight += PILLAR_WEIGHTS[id];
    }
  }

  if (totalWeight === 0) return 0;
  return Math.round((weighted / totalWeight) * 10) / 10;
}

// ─── AM Tasks ─────────────────────────────────────────────────────────────────

export async function updateAMTask(
  companyId: string,
  taskId: string,
  status: AMTaskStatus,
  completedBy: string | null
): Promise<void> {
  const ref = doc(db, 'am_tasks', companyId, 'tasks', taskId);
  await updateDoc(ref, {
    status,
    completedAt: status === 'done' ? serverTimestamp() : null,
    completedBy: status === 'done' ? completedBy : null,
    updatedAt: serverTimestamp(),
  });
}

export function subscribeAMTasks(
  companyId: string,
  date: string,
  shift: string,
  callback: (tasks: AMTask[]) => void,
  onError: (e: Error) => void
): () => void {
  const q = query(
    collection(db, 'am_tasks', companyId, 'tasks'),
    where('dueDate', '==', date),
    where('shift', '==', shift)
  );
  return onSnapshot(
    q,
    (snap) => {
      const tasks = snap.docs.map((d) => ({ id: d.id, ...d.data() } as AMTask));
      callback(tasks);
    },
    onError
  );
}

// ─── Pillar Scores ─────────────────────────────────────────────────────────────

export async function updatePillarScore(
  companyId: string,
  pillarId: TPMPillarId,
  score: number,
  actionPlan: string,
  responsible: string | null
): Promise<void> {
  const monthKey = new Date().toISOString().slice(0, 7); // YYYY-MM
  const ref = doc(db, 'tpm_scores', companyId, 'monthly', monthKey);
  const snap = await getDoc(ref);

  const existing = snap.exists() ? (snap.data() as TPMMonthlyScore) : null;
  const updatedPillars: Partial<Record<TPMPillarId, number>> = {
    ...(existing?.pillars ?? {}),
    [pillarId]: score,
  };

  const composite = calculateTPMScore(updatedPillars);

  await setDoc(
    ref,
    {
      month: monthKey,
      composite,
      pillars: updatedPillars,
      calculatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  // Store pillar metadata (action plan, responsible) in a separate pillar doc
  const pillarRef = doc(db, 'tpm_pillars', companyId, 'pillars', pillarId);
  await setDoc(
    pillarRef,
    {
      id: pillarId,
      name: PILLAR_META[pillarId].name,
      icon: PILLAR_META[pillarId].icon,
      score,
      actionPlan,
      responsible,
      lastUpdated: serverTimestamp(),
    },
    { merge: true }
  );
}

export function subscribePillarData(
  companyId: string,
  callback: (pillars: Record<string, unknown>[]) => void,
  onError: (e: Error) => void
): () => void {
  const q = collection(db, 'tpm_pillars', companyId, 'pillars');
  return onSnapshot(q, (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))), onError);
}

// ─── Monthly Score History ────────────────────────────────────────────────────

export async function fetchMonthlyScores(
  companyId: string,
  months: number
): Promise<TPMMonthlyScore[]> {
  const q = query(
    collection(db, 'tpm_scores', companyId, 'monthly'),
    orderBy('month', 'desc'),
    limit(months)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as TPMMonthlyScore).reverse();
}

// ─── Machine Maturity ─────────────────────────────────────────────────────────

export async function assessMachineMaturity(
  companyId: string,
  machineId: string,
  criteria: Record<string, boolean>,
  assessedBy: string
): Promise<TPMMaturityLevel> {
  const trueCount = Object.values(criteria).filter(Boolean).length;
  const total = Object.values(criteria).length;
  const ratio = total > 0 ? trueCount / total : 0;

  let level: TPMMaturityLevel = 1;
  if (ratio >= 0.85) level = 4;
  else if (ratio >= 0.65) level = 3;
  else if (ratio >= 0.40) level = 2;

  const ref = doc(db, 'tpm_maturity', companyId, 'machines', machineId);
  await setDoc(
    ref,
    {
      level,
      assessedAt: serverTimestamp(),
      assessedBy,
      criteria,
    },
    { merge: true }
  );

  return level;
}

export function subscribeMachineMaturity(
  companyId: string,
  callback: (machines: TPMMachineScore[]) => void,
  onError: (e: Error) => void
): () => void {
  const q = collection(db, 'tpm_maturity', companyId, 'machines');
  return onSnapshot(
    q,
    (snap) => {
      const machines = snap.docs.map((d) => {
        const data = d.data();
        const level = (data.level ?? 1) as TPMMaturityLevel;
        return {
          machineId: d.id,
          machineName: data.machineName ?? d.id,
          maturityLevel: level,
          pillarScores: data.pillarScores ?? {},
          oeeScore: data.oeeScore ?? null,
          lastAssessed: data.assessedAt ?? null,
          nextLevelCriteria: getNextLevelCriteria(level),
          actionRequired: getActionRequired(level),
        } as TPMMachineScore;
      });
      callback(machines);
    },
    onError
  );
}

function getNextLevelCriteria(level: TPMMaturityLevel): string {
  const criteria: Record<TPMMaturityLevel, string> = {
    1: 'Establish AM task schedule, complete 80% of PM tasks on time',
    2: 'Achieve 90% AM compliance, implement condition monitoring on critical machines',
    3: 'Zero unplanned breakdowns for 3 consecutive months, OEE > 85%',
    4: 'World-class status achieved. Sustain and share best practices.',
  };
  return criteria[level];
}

function getActionRequired(level: TPMMaturityLevel): string {
  const actions: Record<TPMMaturityLevel, string> = {
    1: 'Create AM checklist, train operators, establish cleaning standards',
    2: 'Install condition monitoring sensors, analyse breakdown root causes',
    3: 'Deploy predictive analytics, automate anomaly alerts',
    4: 'Document and replicate across all plants',
  };
  return actions[level];
}

// ─── Current Month Score ──────────────────────────────────────────────────────

export function subscribeCurrentMonthScore(
  companyId: string,
  callback: (score: TPMMonthlyScore | null) => void,
  onError: (e: Error) => void
): () => void {
  const monthKey = new Date().toISOString().slice(0, 7);
  const ref = doc(db, 'tpm_scores', companyId, 'monthly', monthKey);
  return onSnapshot(ref, (snap) => callback(snap.exists() ? (snap.data() as TPMMonthlyScore) : null), onError);
}
