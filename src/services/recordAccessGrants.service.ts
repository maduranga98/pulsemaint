import {
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { nanoid } from 'nanoid';
import { db } from '@/lib/firebase';
import { stripUndefined } from '@/lib/recordAccess';
import type { RecordAccessGrant, SharedRecordType } from '@/types/recordAccessGrant';
import type { StaffRequest } from '@/types/staffRequest';

const GRANTS = 'record_access_grants';
const REQUESTS = 'staff_requests';

function mapGrant(id: string, d: Record<string, unknown>): RecordAccessGrant {
  return { id, ...(d as Omit<RecordAccessGrant, 'id'>), snapshot: (d.snapshot as Record<string, unknown>) ?? {} };
}

function soonestExpiryFirst(a: RecordAccessGrant, b: RecordAccessGrant): number {
  return (a.expiresAt?.toMillis?.() ?? 0) - (b.expiresAt?.toMillis?.() ?? 0);
}

export interface SharedRecordInput {
  recordType: SharedRecordType;
  recordId: string;
  recordNumber: string;
  machineName: string;
  plantId: string | null;
  /** The full record as loaded — copied into the grant. */
  data: Record<string, unknown>;
}

export interface ShareRecordsInput {
  request: Pick<StaffRequest, 'id' | 'companyId' | 'requesterId' | 'requesterName' | 'plantId'>;
  records: SharedRecordInput[];
  expiresAt: Date;
  note: string | null;
  grantor: { id: string; name: string; role: string };
  /** Reply text posted on the request thread alongside the share. */
  replyMessage: string;
}

/**
 * Shares the chosen work orders / breakdowns with the requester until
 * `expiresAt`, and records the decision on the request in the same batch.
 */
export async function shareRecordsWithRequester(input: ShareRecordsInput): Promise<void> {
  const { request, grantor } = input;
  const batch = writeBatch(db);
  const expiresAt = Timestamp.fromDate(input.expiresAt);
  for (const r of input.records) {
    const { id: _id, ...rest } = r.data as Record<string, unknown> & { id?: string };
    void _id;
    batch.set(doc(collection(db, GRANTS)), {
      companyId: request.companyId,
      plantId: r.plantId ?? request.plantId ?? null,
      requestId: request.id,
      granteeId: request.requesterId,
      granteeName: request.requesterName,
      grantedBy: grantor.id,
      grantedByName: grantor.name,
      grantedByRole: grantor.role,
      recordType: r.recordType,
      recordId: r.recordId,
      recordNumber: r.recordNumber,
      machineName: r.machineName,
      note: input.note,
      snapshot: stripUndefined(rest),
      expiresAt,
      createdAt: serverTimestamp(),
    });
  }
  batch.update(doc(db, REQUESTS, request.id), {
    replies: arrayUnion({
      id: nanoid(10),
      authorId: grantor.id,
      authorName: grantor.name,
      authorRole: grantor.role,
      message: input.replyMessage,
      attachments: [],
      createdAt: Timestamp.now(),
    }),
    status: 'answered',
    decision: 'granted',
    updatedAt: serverTimestamp(),
    closedAt: null,
  });
  await batch.commit();
}

/** Declines a record_access request: posts the reason and closes it. */
export async function rejectRecordRequest(input: {
  requestId: string;
  author: { id: string; name: string; role: string };
  message: string;
}): Promise<void> {
  await updateDoc(doc(db, REQUESTS, input.requestId), {
    replies: arrayUnion({
      id: nanoid(10),
      authorId: input.author.id,
      authorName: input.author.name,
      authorRole: input.author.role,
      message: input.message,
      attachments: [],
      createdAt: Timestamp.now(),
    }),
    status: 'closed',
    decision: 'rejected',
    updatedAt: serverTimestamp(),
    closedAt: serverTimestamp(),
  });
}

/** Ends a share before its expiry. */
export async function revokeRecordGrant(grantId: string): Promise<void> {
  await deleteDoc(doc(db, GRANTS, grantId));
}

function subscribe(
  constraints: ReturnType<typeof where>[],
  cb: (rows: RecordAccessGrant[]) => void,
  onError?: (msg: string) => void,
): () => void {
  // Equality-only filters, sorted client-side — no composite index needed.
  return onSnapshot(
    query(collection(db, GRANTS), ...constraints),
    (snap) => cb(snap.docs.map((d) => mapGrant(d.id, d.data())).sort(soonestExpiryFirst)),
    (err) => onError?.(err.message),
  );
}

/** Every record shared with the signed-in user (expired ones included — filter with isGrantActive). */
export function subscribeMyRecordGrants(
  companyId: string,
  userId: string,
  cb: (rows: RecordAccessGrant[]) => void,
  onError?: (msg: string) => void,
): () => void {
  return subscribe([where('companyId', '==', companyId), where('granteeId', '==', userId)], cb, onError);
}

/** Grants issued for one request — the handler's view. */
export function subscribeRequestRecordGrants(
  companyId: string,
  requestId: string,
  cb: (rows: RecordAccessGrant[]) => void,
  onError?: (msg: string) => void,
): () => void {
  return subscribe([where('companyId', '==', companyId), where('requestId', '==', requestId)], cb, onError);
}
