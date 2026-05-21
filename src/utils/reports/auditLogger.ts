import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import type { AuditAction, AuditChange, AuditEntityType } from '../../types/reports.types';

interface LogAuditEventInput {
  companyId: string;
  userId: string;
  userName: string;
  userRole: string;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: string;
  entityName: string;
  changes?: AuditChange[] | null;
  ipAddress?: string | null;
  sessionId?: string | null;
}

export async function logAuditEvent(input: LogAuditEventInput): Promise<void> {
  await addDoc(collection(db, 'audit_logs'), {
    ...input,
    changes: input.changes ?? null,
    ipAddress: input.ipAddress ?? null,
    userAgent: typeof navigator === 'undefined' ? null : navigator.userAgent,
    sessionId: input.sessionId ?? null,
    timestamp: serverTimestamp(),
  });
}
