import type { Timestamp } from 'firebase/firestore';

export type SharedRecordType = 'work_order' | 'breakdown';

/**
 * A time-limited share of one work order / breakdown with the person who
 * raised a record_access request. The record is copied into `snapshot` when
 * it's shared, so the requester can view it without read access to the
 * source collection. The grant disappears from their Requests page once
 * `expiresAt` passes and is deleted by the `purgeExpiredRecordGrants`
 * scheduled function (or earlier, if the grantor revokes it).
 */
export interface RecordAccessGrant {
  id: string;
  companyId: string;
  plantId: string | null;
  /** The staff_requests doc this grant answers. */
  requestId: string;

  granteeId: string;
  granteeName: string;

  grantedBy: string;
  grantedByName: string;
  grantedByRole: string;

  recordType: SharedRecordType;
  recordId: string;
  /** WO number / breakdown ticket number. */
  recordNumber: string;
  machineName: string;
  note: string | null;
  /** Full copy of the record at the time it was shared. */
  snapshot: Record<string, unknown>;

  expiresAt: Timestamp;
  createdAt: Timestamp;
}

/** Roles that may share records in answer to a record_access request. */
export const RECORD_GRANTOR_ROLES = ['admin', 'plant_manager'] as const;

export function canGrantRecords(role: string | undefined | null): boolean {
  return !!role && (RECORD_GRANTOR_ROLES as readonly string[]).includes(role);
}
