import {
  addDoc,
  collection,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type {
  SafetyCase,
  SafetyCaseInput,
  SafetyCaseStatus,
  WorkPermit,
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
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    closedAt: null,
  });
  return ref.id;
}

export async function updateWorkPermitStatus(id: string, status: WorkPermitStatus): Promise<void> {
  await updateDoc(doc(db, PERMITS, id), {
    status,
    updatedAt: serverTimestamp(),
    closedAt: status === 'closed' || status === 'expired' ? serverTimestamp() : null,
  });
}
