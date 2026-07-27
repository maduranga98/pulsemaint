import {
  addDoc,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import {
  getStorage,
  ref as storageRef,
  uploadBytesResumable,
  getDownloadURL,
} from 'firebase/storage';
import { db } from '@/lib/firebase';
import { nanoid } from 'nanoid';
import type {
  EvaluationSession,
  EvaluationAttachment,
  AttachmentType,
  EvaluationTemplate,
  EvaluationActionLog,
} from '../types/evaluation.types';

const COL = 'evaluations';
const TEMPLATES_COL = 'evaluation_templates';

export async function fetchEvaluations(companyId: string): Promise<EvaluationSession[]> {
  // No orderBy here: companyId + orderBy(createdAt) needs a composite index.
  // If it isn't deployed the query fails and finished evaluations silently
  // never show up in the Evaluations tab — sort client-side instead.
  const snap = await getDocs(
    query(collection(db, COL), where('companyId', '==', companyId)),
  );
  return snap.docs.map(normalizeEvaluation).sort(byNewest);
}

function normalizeEvaluation(d: { id: string; data: () => Record<string, unknown> }): EvaluationSession {
  const session = { id: d.id, ...d.data() } as EvaluationSession;
  // Older documents may miss these array fields — normalize them so the UI
  // never crashes on `.length` of undefined.
  session.criteria = session.criteria ?? [];
  session.attachments = session.attachments ?? [];
  session.actionLog = session.actionLog ?? [];
  return session;
}

const byNewest = (a: EvaluationSession, b: EvaluationSession) =>
  (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0);

/** Live evaluations for a company — updates the list as evaluations are saved. */
export function subscribeEvaluations(
  companyId: string,
  callback: (sessions: EvaluationSession[]) => void,
  onError?: (message: string) => void,
): () => void {
  return onSnapshot(
    query(collection(db, COL), where('companyId', '==', companyId)),
    (snap) => callback(snap.docs.map(normalizeEvaluation).sort(byNewest)),
    (err) => onError?.(err.message),
  );
}

export async function submitEvaluation(
  session: Omit<EvaluationSession, 'id' | 'createdAt' | 'submittedAt'>,
): Promise<string> {
  const docRef = await addDoc(collection(db, COL), {
    ...session,
    status: 'submitted',
    createdAt: serverTimestamp(),
    submittedAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function saveDraftEvaluation(
  session: Omit<EvaluationSession, 'id' | 'createdAt' | 'submittedAt'>,
): Promise<string> {
  const docRef = await addDoc(collection(db, COL), {
    ...session,
    status: 'draft',
    createdAt: serverTimestamp(),
    submittedAt: null,
  });
  return docRef.id;
}

/** Resumes an ongoing (draft) evaluation and either re-saves it as a draft or submits it. */
export async function updateEvaluation(
  id: string,
  session: Omit<EvaluationSession, 'id' | 'createdAt' | 'submittedAt' | 'status'>,
  status: 'draft' | 'submitted',
): Promise<void> {
  await updateDoc(doc(db, COL, id), {
    ...session,
    status,
    submittedAt: status === 'submitted' ? serverTimestamp() : null,
  });
}

// ─── Custom evaluation form templates (PM-122) ──────────────────────────────

export async function fetchEvaluationTemplates(companyId: string): Promise<EvaluationTemplate[]> {
  const snap = await getDocs(
    query(collection(db, TEMPLATES_COL), where('companyId', '==', companyId)),
  );
  return snap.docs.map((d) => {
    const template = { id: d.id, ...d.data() } as EvaluationTemplate;
    template.criteria = template.criteria ?? [];
    return template;
  });
}

export async function saveEvaluationTemplate(
  template: Omit<EvaluationTemplate, 'id' | 'createdAt' | 'updatedAt'> & { id?: string },
): Promise<string> {
  const { id, ...data } = template;
  if (id) {
    await updateDoc(doc(db, TEMPLATES_COL, id), { ...data, updatedAt: serverTimestamp() });
    return id;
  }
  const docRef = await addDoc(collection(db, TEMPLATES_COL), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function deleteEvaluationTemplate(id: string): Promise<void> {
  await deleteDoc(doc(db, TEMPLATES_COL, id));
}

// ─── Post-evaluation actions (PM-124) ───────────────────────────────────────

export async function logEvaluationAction(
  evaluationId: string,
  action: Omit<EvaluationActionLog, 'id' | 'at'>,
): Promise<void> {
  const entry: EvaluationActionLog = { ...action, id: nanoid(), at: null };
  await updateDoc(doc(db, COL, evaluationId), {
    // serverTimestamp() cannot be used inside arrayUnion; record client time instead.
    actionLog: arrayUnion({ ...entry, at: new Date() }),
  });
}

export async function updateEvaluateePosition(
  companyId: string,
  userId: string,
  newJobTitle: string,
): Promise<void> {
  await updateDoc(doc(db, `companies/${companyId}/users/${userId}`), {
    jobTitle: newJobTitle,
    updatedAt: serverTimestamp(),
  });
}

export async function uploadEvaluationAttachment(
  companyId: string,
  evaluationId: string,
  file: File,
  onProgress?: (pct: number) => void,
): Promise<EvaluationAttachment> {
  const storage = getStorage();
  const ext = file.name.split('.').pop() ?? '';
  const id = nanoid();
  const path = `evaluation_attachments/${companyId}/${evaluationId}/${id}.${ext}`;
  const sRef = storageRef(storage, path);
  await new Promise<void>((resolve, reject) => {
    const task = uploadBytesResumable(sRef, file);
    task.on(
      'state_changed',
      (snap) => onProgress && onProgress((snap.bytesTransferred / snap.totalBytes) * 100),
      reject,
      () => resolve(),
    );
  });
  const url = await getDownloadURL(sRef);
  let type: AttachmentType = 'document';
  if (file.type.startsWith('image/')) type = 'image';
  else if (file.type.startsWith('video/')) type = 'video';
  return { id, type, name: file.name, url, mimeType: file.type, size: file.size };
}
