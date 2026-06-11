import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  serverTimestamp,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { httpsCallable } from 'firebase/functions';
import { db, storage, functions } from '../../lib/firebase';
import type {
  TriageCategory,
  TriageContentItem,
  TriageContact,
  TriageAssessment,
  AITriageResponse,
} from './types';

export const COL = {
  categories: 'triage_categories',
  content: 'triage_content_items',
  contacts: 'triage_contacts',
  assessments: 'triage_assessments',
  results: 'triage_assessment_results',
} as const;

type WithoutMeta<T> = Omit<T, 'id' | 'companyId' | 'createdAt' | 'updatedAt' | 'createdBy'>;

const base = (companyId: string, uid: string) => ({
  companyId,
  createdBy: uid,
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
});

export async function addCategory(
  companyId: string,
  uid: string,
  data: WithoutMeta<TriageCategory>,
) {
  return addDoc(collection(db, COL.categories), { ...data, ...base(companyId, uid) });
}

export async function deleteCategory(id: string) {
  return deleteDoc(doc(db, COL.categories, id));
}

export async function addContentItem(
  companyId: string,
  uid: string,
  data: WithoutMeta<TriageContentItem>,
) {
  return addDoc(collection(db, COL.content), { ...data, ...base(companyId, uid) });
}

export async function deleteContentItem(id: string) {
  return deleteDoc(doc(db, COL.content, id));
}

export async function uploadPdf(file: File): Promise<string> {
  const uid = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const fileRef = ref(storage, `triage/pdfs/${uid}.pdf`);
  await uploadBytes(fileRef, file);
  return getDownloadURL(fileRef);
}

export async function addContact(
  companyId: string,
  uid: string,
  data: WithoutMeta<TriageContact>,
) {
  return addDoc(collection(db, COL.contacts), { ...data, ...base(companyId, uid) });
}

export async function deleteContact(id: string) {
  return deleteDoc(doc(db, COL.contacts, id));
}

export async function addAssessment(
  companyId: string,
  uid: string,
  data: WithoutMeta<TriageAssessment>,
) {
  return addDoc(collection(db, COL.assessments), { ...data, ...base(companyId, uid) });
}

export async function deleteAssessment(id: string) {
  return deleteDoc(doc(db, COL.assessments, id));
}

export async function writeAssessmentResult(
  companyId: string,
  uid: string,
  data: { assessmentId: string; score: number; total: number; passed: boolean },
) {
  return addDoc(collection(db, COL.results), {
    ...data,
    companyId,
    userId: uid,
    completedAt: serverTimestamp(),
  });
}

export async function callTriageAssist(
  situation: string,
  machineId?: string,
): Promise<AITriageResponse> {
  const fn = httpsCallable<
    { situation: string; machineId?: string },
    AITriageResponse
  >(functions, 'triageAssist');
  const result = await fn({ situation, machineId });
  return result.data;
}
