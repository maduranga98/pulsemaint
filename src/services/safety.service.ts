import {
  addDoc,
  arrayUnion,
  collection,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type {
  SafetyCase,
  SafetyCaseAction,
  SafetyCaseInput,
  SafetyCaseStatus,
  WorkPermit,
  WorkPermitCompletion,
  WorkPermitInput,
  WorkPermitStatus,
} from '../types/safety';

const CASES = 'safety_cases';
const PERMITS = 'work_permits';

function mapCase(id: string, d: Record<string, unknown>): SafetyCase {
  return { id, ...(d as Omit<SafetyCase, 'id'>) };
}
function mapPermit(id: string, d: Record<string, unknown>): WorkPermit {
  return { id, ...(d as Omit<WorkPermit, 'id'>) };
}

// ── Safety cases ────────────────────────────────────────────────────────────

export function subscribeSafetyCases(
  companyId: string,
  cb: (cases: SafetyCase[]) => void,
  onError?: (msg: string) => void,
): () => void {
  return onSnapshot(
    query(collection(db, CASES), where('companyId', '==', companyId), orderBy('reportedAt', 'desc'), limit(500)),
    (snap) => cb(snap.docs.map((d) => mapCase(d.id, d.data()))),
    (err) => onError?.(err.message),
  );
}

export async function createSafetyCase(input: SafetyCaseInput): Promise<string> {
  const ref = await addDoc(collection(db, CASES), {
    ...input,
    reportedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    closedAt: null,
  });
  return ref.id;
}

export async function updateSafetyCaseStatus(id: string, status: SafetyCaseStatus): Promise<void> {
  await updateDoc(doc(db, CASES, id), {
    status,
    updatedAt: serverTimestamp(),
    closedAt: status === 'closed' ? serverTimestamp() : null,
  });
}

/**
 * Append an action to a case's log and, optionally, move its status. Used from
 * the Safety Cases tab where the safety officer (or the manager the case was
 * reported to) records what was done about the case.
 */
export async function addSafetyCaseAction(
  id: string,
  action: Omit<SafetyCaseAction, 'at'>,
): Promise<void> {
  // serverTimestamp() can't be used inside array elements, so stamp locally.
  const entry: SafetyCaseAction = { ...action, at: Timestamp.now() };
  const patch: Record<string, unknown> = {
    actions: arrayUnion(entry),
    updatedAt: serverTimestamp(),
  };
  if (action.newStatus) {
    patch.status = action.newStatus;
    patch.closedAt = action.newStatus === 'closed' ? serverTimestamp() : null;
  }
  await updateDoc(doc(db, CASES, id), patch);
}

// ── Work permits ─────────────────────────────────────────────────────────────

export function subscribeWorkPermits(
  companyId: string,
  cb: (permits: WorkPermit[]) => void,
  onError?: (msg: string) => void,
): () => void {
  return onSnapshot(
    query(collection(db, PERMITS), where('companyId', '==', companyId), orderBy('createdAt', 'desc'), limit(500)),
    (snap) => cb(snap.docs.map((d) => mapPermit(d.id, d.data()))),
    (err) => onError?.(err.message),
  );
}

/** PTW-YYYY-#### where #### is the next sequence for the year, best-effort. */
async function nextPermitNumber(companyId: string): Promise<string> {
  const year = new Date().getFullYear();
  const snap = await getDocs(
    query(collection(db, PERMITS), where('companyId', '==', companyId)),
  );
  const seq = snap.docs.filter((d) => String(d.data().permitNumber ?? '').includes(`PTW-${year}-`)).length + 1;
  return `PTW-${year}-${String(seq).padStart(4, '0')}`;
}

export async function createWorkPermit(input: WorkPermitInput): Promise<string> {
  const permitNumber = await nextPermitNumber(input.companyId);
  const ref = await addDoc(collection(db, PERMITS), {
    ...input,
    permitNumber,
    completion: null,
    completionNote: '',
    signedOffBy: null,
    signedOffByName: null,
    signedOffAt: null,
    overdueNotifiedAt: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    closedAt: null,
  });
  // When the permit is raised against a work order, flag that WO so the
  // assigned technician sees the permit gate when they open the WO to start
  // it. Without this the permit exists but the WO never asks for it.
  if (input.workOrderId) {
    try {
      await updateDoc(doc(db, 'workOrders', input.workOrderId), {
        requiresWorkPermit: true,
        workPermitId: ref.id,
        ptwCategory: input.category,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      // Non-fatal: the permit is created regardless; log for diagnosis.
      console.error('Failed to flag work order with its work permit', err);
    }
  }
  return ref.id;
}

export async function updateWorkPermitStatus(id: string, status: WorkPermitStatus): Promise<void> {
  await updateDoc(doc(db, PERMITS, id), {
    status,
    updatedAt: serverTimestamp(),
    closedAt: status === 'closed' || status === 'expired' ? serverTimestamp() : null,
  });
}

/** Push a permit's validity out to a new end date (extension). */
export async function extendWorkPermit(id: string, newValidTo: string): Promise<void> {
  await updateDoc(doc(db, PERMITS, id), {
    validTo: newValidTo,
    status: 'active',
    // A fresh window means the overdue reminder should be able to fire again.
    overdueNotifiedAt: null,
    updatedAt: serverTimestamp(),
  });
}

interface SignOffWorkPermitInput {
  completion: WorkPermitCompletion;
  completionNote: string;
  signedOffBy: string;
  signedOffByName: string;
}

/** Finish a permit: record completion status + optional note and close it. */
export async function signOffWorkPermit(id: string, input: SignOffWorkPermitInput): Promise<void> {
  await updateDoc(doc(db, PERMITS, id), {
    status: 'closed',
    completion: input.completion,
    completionNote: input.completionNote,
    signedOffBy: input.signedOffBy,
    signedOffByName: input.signedOffByName,
    signedOffAt: serverTimestamp(),
    closedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

/** Stamp that the overdue reminder has been sent, so it isn't sent again. */
export async function markWorkPermitOverdueNotified(id: string): Promise<void> {
  await updateDoc(doc(db, PERMITS, id), { overdueNotifiedAt: serverTimestamp() });
}
