import type { Timestamp } from 'firebase/firestore';

export interface WhyEntry {
  question: string;
  answer: string;
}

export type RCAStatus = 'open' | 'completed';

export interface RCA {
  id: string;
  breakdownId: string;
  machineId: string;
  siteId: string;
  problem: string;
  whys: WhyEntry[];
  rootCause: string;
  correctiveAction: string | null;
  linkedPmUpdate: string | null;
  linkedWOId: string | null;
  status: RCAStatus;
  createdBy: string;
  createdByName: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
