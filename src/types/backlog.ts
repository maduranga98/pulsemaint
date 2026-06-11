import type { Timestamp } from 'firebase/firestore';

// ---------------------------------------------------------------------------
// Deferred-maintenance Backlog + Risk Scoring
// ---------------------------------------------------------------------------

export type BacklogStatus = 'open' | 'scheduled' | 'closed';

/** 1–5 likelihood/consequence scale. */
export type RiskScale = 1 | 2 | 3 | 4 | 5;

export interface BacklogItem {
  id: string;
  companyId: string;
  siteId: string;

  machineId: string;
  machineName: string;
  machineCriticality: 1 | 2 | 3 | 4 | 5;
  machineFlaggedCritical: boolean;

  description: string;
  identifiedAt: Timestamp;
  deferredReason: string;

  likelihood: RiskScale;
  consequence: RiskScale;
  riskScore: number; // likelihood * consequence, computed on write

  status: BacklogStatus;

  // Set when promoted into a scheduled Work Order.
  linkedWOId?: string | null;
  linkedWONumber?: string | null;

  createdBy: string;
  createdByName: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface CreateBacklogPayload {
  machineId: string;
  machineName: string;
  machineCriticality: 1 | 2 | 3 | 4 | 5;
  machineFlaggedCritical: boolean;
  description: string;
  deferredReason: string;
  likelihood: RiskScale;
  consequence: RiskScale;
}

/** riskScore >= this threshold on a critical machine triggers a manager alert. */
export const HIGH_RISK_THRESHOLD = 15;

export function computeRiskScore(likelihood: number, consequence: number): number {
  return likelihood * consequence;
}

export function isHighRiskCritical(item: {
  riskScore: number;
  machineFlaggedCritical: boolean;
}): boolean {
  return item.riskScore >= HIGH_RISK_THRESHOLD && item.machineFlaggedCritical;
}
