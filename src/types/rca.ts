import type { Timestamp } from 'firebase/firestore';
import type { BreakdownSeverity } from './breakdown';

// ---------------------------------------------------------------------------
// 5-Why Root Cause Analysis
// ---------------------------------------------------------------------------

export type RcaStatus = 'open' | 'completed';

export interface RcaWhy {
  question: string;
  answer: string;
}

export interface Rca {
  id: string;
  companyId: string;
  siteId: string;

  // Links
  breakdownId: string;
  breakdownTicketNumber: string;
  machineId: string;
  machineName: string;
  severity: BreakdownSeverity;

  // 5-Why content
  problem: string;
  whys: RcaWhy[];
  rootCause: string;
  correctiveAction?: string | null;

  // Linked corrective-action work order (auto-generated)
  linkedWOId?: string | null;
  linkedWONumber?: string | null;

  // Optional link to a PM schedule update spawned from the RCA
  linkedPmUpdate?: string | null;

  status: RcaStatus;

  createdBy: string;
  createdByName: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  completedAt?: Timestamp | null;
}

// Payload from the guided modal (whys always length 5).
export interface RcaPayload {
  breakdownId: string;
  breakdownTicketNumber: string;
  machineId: string;
  machineName: string;
  severity: BreakdownSeverity;
  problem: string;
  whys: RcaWhy[];
  rootCause: string;
  correctiveAction?: string;
  status: RcaStatus;
  createCorrectiveWorkOrder: boolean;
}

// Severities that require an RCA before a breakdown may be closed.
export const RCA_REQUIRED_SEVERITIES: BreakdownSeverity[] = ['medium', 'high', 'critical'];

export function rcaRequiredForSeverity(severity: BreakdownSeverity): boolean {
  return RCA_REQUIRED_SEVERITIES.includes(severity);
}
