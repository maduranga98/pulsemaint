import {
  addDoc,
  collection,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
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
import type { EvaluationSession, EvaluationAttachment, AttachmentType } from '../types/evaluation.types';

const COL = 'evaluations';

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
