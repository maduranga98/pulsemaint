import {
  addDoc, collection, doc, limit, onSnapshot, orderBy, query, serverTimestamp, updateDoc, where,
  type Timestamp, type Unsubscribe,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

/** Feedback & special requests from company admins to Lumora Ventures (collection supportRequests). */

export type SupportRequestType = 'feedback' | 'feature' | 'special' | 'billing' | 'support';
export type SupportRequestStatus = 'open' | 'in_progress' | 'resolved' | 'closed';

export const SUPPORT_REQUEST_TYPES: SupportRequestType[] = ['feedback', 'feature', 'special', 'billing', 'support'];
export const SUPPORT_REQUEST_STATUSES: SupportRequestStatus[] = ['open', 'in_progress', 'resolved', 'closed'];

export interface SupportRequest {
  id: string;
  companyId: string;
  companyName: string;
  createdBy: string;
  createdByName: string;
  createdByEmail: string | null;
  type: SupportRequestType;
  subject: string;
  message: string;
  status: SupportRequestStatus;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
  lastMessageAt?: Timestamp | null;
  lastMessageBy?: 'company' | 'lumora' | null;
}

export interface SupportMessage {
  id: string;
  authorType: 'company' | 'lumora';
  authorUid: string;
  authorName: string;
  body: string;
  createdAt: Timestamp | null;
}

const col = collection(db, 'supportRequests');

export function createSupportRequest(input: {
  companyId: string; companyName: string; uid: string; name: string; email: string | null;
  type: SupportRequestType; subject: string; message: string;
}): Promise<unknown> {
  return addDoc(col, {
    companyId: input.companyId,
    companyName: input.companyName,
    createdBy: input.uid,
    createdByName: input.name,
    createdByEmail: input.email,
    type: input.type,
    subject: input.subject.trim().slice(0, 200),
    message: input.message.trim().slice(0, 5000),
    status: 'open',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

/** A company admin's view: its own company's requests, newest first. */
export function subscribeCompanyRequests(companyId: string, cb: (rows: SupportRequest[]) => void, onError?: (e: Error) => void): Unsubscribe {
  return onSnapshot(
    query(col, where('companyId', '==', companyId), orderBy('createdAt', 'desc'), limit(100)),
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as SupportRequest)),
    onError,
  );
}

/** Lumora superadmins: every company's requests. */
export function subscribeAllRequests(cb: (rows: SupportRequest[]) => void, onError?: (e: Error) => void): Unsubscribe {
  return onSnapshot(
    query(col, orderBy('updatedAt', 'desc'), limit(300)),
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as SupportRequest)),
    onError,
  );
}

export function subscribeRequest(id: string, cb: (row: SupportRequest | null) => void): Unsubscribe {
  return onSnapshot(doc(db, 'supportRequests', id), (snap) => cb(snap.exists() ? ({ id: snap.id, ...snap.data() } as SupportRequest) : null));
}

export function subscribeMessages(requestId: string, cb: (rows: SupportMessage[]) => void): Unsubscribe {
  return onSnapshot(
    query(collection(db, 'supportRequests', requestId, 'messages'), orderBy('createdAt', 'asc')),
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as SupportMessage)),
  );
}

export async function addSupportMessage(requestId: string, author: { type: 'company' | 'lumora'; uid: string; name: string }, body: string) {
  await addDoc(collection(db, 'supportRequests', requestId, 'messages'), {
    authorType: author.type,
    authorUid: author.uid,
    authorName: author.name,
    body: body.trim().slice(0, 5000),
    createdAt: serverTimestamp(),
  });
  await updateDoc(doc(db, 'supportRequests', requestId), {
    updatedAt: serverTimestamp(),
    lastMessageAt: serverTimestamp(),
    lastMessageBy: author.type,
  });
}

/** Lumora superadmins only (enforced by firestore.rules). */
export function setSupportRequestStatus(requestId: string, status: SupportRequestStatus) {
  return updateDoc(doc(db, 'supportRequests', requestId), { status, updatedAt: serverTimestamp() });
}
