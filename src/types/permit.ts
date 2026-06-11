import type { Timestamp } from 'firebase/firestore';

export type PermitType = 'LOTO' | 'PTW';
export type PermitStatus = 'draft' | 'issued' | 'active' | 'closed' | 'cancelled';

export interface IsolationChecklistEntry {
  pointId: string;
  locked: boolean;
  lockedBy: string | null;
  lockedByName: string | null;
  lockedAt: Timestamp | null;
}

export interface Permit {
  id: string;
  workOrderId: string;
  machineId: string;
  siteId: string;
  type: PermitType;
  category: string | null;
  isolationChecklist: IsolationChecklistEntry[];
  zeroEnergyVerified: boolean;
  zeroEnergyVerifiedBy: string | null;
  zeroEnergyVerifiedByName: string | null;
  zeroEnergyVerifiedAt: Timestamp | null;
  status: PermitStatus;
  issuedBy: string | null;
  issuedByName: string | null;
  issuedAt: Timestamp | null;
  closedBy: string | null;
  closedByName: string | null;
  closedAt: Timestamp | null;
  cancelledBy: string | null;
  cancelledAt: Timestamp | null;
  createdBy: string;
  createdByName: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
