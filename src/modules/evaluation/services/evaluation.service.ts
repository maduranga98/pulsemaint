import {
  addDoc,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
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
  const snap = await getDocs(
    query(
      collection(db, COL),
      where('companyId', '==', companyId),
      orderBy('createdAt', 'desc'),
    ),
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as EvaluationSession));
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

// ─── Custom evaluation form templates (PM-122) ──────────────────────────────

export async function fetchEvaluationTemplates(companyId: string): Promise<EvaluationTemplate[]> {
  const snap = await getDocs(
    query(collection(db, TEMPLATES_COL), where('companyId', '==', companyId)),
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as EvaluationTemplate));
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
