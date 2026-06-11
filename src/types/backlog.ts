import type { Timestamp } from 'firebase/firestore';

export type BacklogStatus = 'open' | 'scheduled' | 'closed';

export interface MaintenanceBacklogItem {
  id: string;
  siteId: string;
  machineId: string;
  machineName: string;
  machineLocation: string;
  machineDepartment: string;
  machineCriticality: 1 | 2 | 3 | 4 | 5;
  description: string;
  identifiedAt: Timestamp;
  deferredReason: string;
  likelihood: 1 | 2 | 3 | 4 | 5;
  consequence: 1 | 2 | 3 | 4 | 5;
  riskScore: number;
  status: BacklogStatus;
  linkedWOId: string | null;
  createdBy: string;
  createdByName: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface CreateBacklogItemPayload {
  machineId: string;
  machineName: string;
  machineLocation: string;
  machineDepartment: string;
  machineCriticality: 1 | 2 | 3 | 4 | 5;
  description: string;
  deferredReason: string;
  likelihood: 1 | 2 | 3 | 4 | 5;
  consequence: 1 | 2 | 3 | 4 | 5;
}
