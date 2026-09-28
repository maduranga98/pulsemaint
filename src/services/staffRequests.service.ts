import {
  arrayUnion,
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  type QueryConstraint,
} from 'firebase/firestore';
import { getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage';
import { nanoid } from 'nanoid';
import { db, storage } from '@/lib/firebase';
import { sameDepartment } from '@/hooks/useRecordPlantMatcher';
import type {
  StaffRequest,
  StaffRequestAttachment,
  StaffRequestCategory,
  StaffRequestRecipientRole,
  StaffRequestStatus,
} from '@/types/staffRequest';

const REQUESTS = 'staff_requests';

function mapRequest(id: string, d: Record<string, unknown>): StaffRequest {
  return {
    id,
    ...(d as Omit<StaffRequest, 'id'>),
    attachments: (d.attachments as StaffRequestAttachment[] | undefined) ?? [],
    replies: (d.replies as StaffRequest['replies'] | undefined) ?? [],
  };
}

function newestFirst(a: StaffRequest, b: StaffRequest): number {
  const at = (r: StaffRequest) => r.updatedAt?.toMillis?.() ?? r.createdAt?.toMillis?.() ?? 0;
  return at(b) - at(a);
}

/** Uploads files under the company's storage area for this request. */
export async function uploadRequestAttachments(
  companyId: string,
  requestId: string,
  files: File[],
): Promise<StaffRequestAttachment[]> {
  const out: StaffRequestAttachment[] = [];
  for (const file of files) {
    const id = nanoid(10);
    const safeName = file.name.replace(/[^\w.\- ]+/g, '_');
    const path = `companies/${companyId}/staff_requests/${requestId}/${id}-${safeName}`;
    const sRef = storageRef(storage, path);
    await uploadBytes(sRef, file, { contentType: file.type || undefined });
    const url = await getDownloadURL(sRef);
    out.push({ id, name: file.name, url, storagePath: path, size: file.size, contentType: file.type || '' });
  }
  return out;
}

export interface CreateStaffRequestInput {
  companyId: string;
  plantId: string | null;
  department: string | null;
  requesterId: string;
  requesterName: string;
  requesterRole: string;
  category: StaffRequestCategory;
  subject: string;
  message: string;
  reference: string | null;
  referenceType?: 'work_order' | 'breakdown' | null;
  referenceId?: string | null;
  referenceMachineName?: string | null;
  recipientRole: StaffRequestRecipientRole;
  recipientUserId: string;
  recipientName: string;
  files: File[];
}

export async function createStaffRequest(input: CreateStaffRequestInput): Promise<string> {
  const ref = doc(collection(db, REQUESTS));
  const attachments = input.files.length
    ? await uploadRequestAttachments(input.companyId, ref.id, input.files)
    : [];
  const { files: _files, ...rest } = input;
  void _files;
  await setDoc(ref, {
    ...rest,
    attachments,
    status: 'open' as StaffRequestStatus,
    replies: [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    closedAt: null,
  });
  return ref.id;
}

export interface AddReplyInput {
  companyId: string;
  requestId: string;
  authorId: string;
  authorName: string;
  authorRole: string;
  message: string;
  files: File[];
  /** Status to move the request to along with the reply. */
  status: StaffRequestStatus;
}

export async function addStaffRequestReply(input: AddReplyInput): Promise<void> {
  const attachments = input.files.length
    ? await uploadRequestAttachments(input.companyId, input.requestId, input.files)
    : [];
  await updateDoc(doc(db, REQUESTS, input.requestId), {
    replies: arrayUnion({
      id: nanoid(10),
      authorId: input.authorId,
      authorName: input.authorName,
      authorRole: input.authorRole,
      message: input.message,
      attachments,
      // serverTimestamp() isn't allowed inside array elements.
      createdAt: Timestamp.now(),
    }),
    status: input.status,
    updatedAt: serverTimestamp(),
    closedAt: input.status === 'closed' ? serverTimestamp() : null,
  });
}

export async function setStaffRequestStatus(requestId: string, status: StaffRequestStatus): Promise<void> {
  await updateDoc(doc(db, REQUESTS, requestId), {
    status,
    updatedAt: serverTimestamp(),
    closedAt: status === 'closed' ? serverTimestamp() : null,
  });
}

function subscribe(
  constraints: QueryConstraint[],
  cb: (rows: StaffRequest[]) => void,
  onError?: (msg: string) => void,
): () => void {
  // Equality-only filters, sorted client-side — no composite index needed.
  return onSnapshot(
    query(collection(db, REQUESTS), ...constraints),
    (snap) => cb(snap.docs.map((d) => mapRequest(d.id, d.data())).sort(newestFirst)),
    (err) => onError?.(err.message),
  );
}

/** Requests the signed-in user raised. */
export function subscribeMyStaffRequests(
  companyId: string,
  userId: string,
  cb: (rows: StaffRequest[]) => void,
  onError?: (msg: string) => void,
): () => void {
  return subscribe([where('companyId', '==', companyId), where('requesterId', '==', userId)], cb, onError);
}

/**
 * Requests addressed to the signed-in handler:
 * - supervisor: own plant + own department
 * - plant_manager: own plant
 * - admin: every admin-addressed request in the company (optionally one plant)
 */
export function subscribeRequestInbox(
  opts: {
    companyId: string;
    userId: string;
    role: StaffRequestRecipientRole;
    plantId: string | null;
    department: string | null;
  },
  cb: (rows: StaffRequest[]) => void,
  onError?: (msg: string) => void,
): () => void {
  const constraints: QueryConstraint[] = [
    where('companyId', '==', opts.companyId),
    where('recipientRole', '==', opts.role),
  ];
  if (opts.role !== 'admin' || opts.plantId) {
    constraints.push(where('plantId', '==', opts.plantId ?? null));
  }
  return subscribe(
    constraints,
    (rows) =>
      cb(
        rows.filter((r) => {
          // Sent to a named person — only that person's inbox.
          if (r.recipientUserId) return r.recipientUserId === opts.userId;
          // Older role-group requests: supervisors of the department
          // (compared case/spacing-insensitively), otherwise the whole role.
          return opts.role !== 'supervisor' || sameDepartment(r.department, opts.department);
        }),
      ),
    onError,
  );
}
