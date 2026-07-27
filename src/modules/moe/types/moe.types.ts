import type { Timestamp } from 'firebase/firestore';
import type { MachineCriticality } from '../../../types/machine';

export type MoePeriodType = 'daily' | 'weekly' | 'monthly';

export interface MoeSnapshot {
  id: string;
  siteId: string;
  machineId: string;
  periodStart: Timestamp;
  periodEnd: Timestamp;
  periodType: MoePeriodType;
  availabilityScore: number;
  maintenanceComplianceScore: number;
  reliabilityScore: number;
  healthScore: number;
  moeScore: number;
  breakdownCount: number;
  totalDowntimeMinutes: number;
  pmScheduledCount: number;
  pmCompletedOnTimeCount: number;
  criticality: MachineCriticality;
  calculatedAt: Timestamp;
}

export interface MoeWeights {
  availability: number;
  maintenanceCompliance: number;
  reliability: number;
  health: number;
}

export interface MoeStatusBands {
  excellent: number; // >= this value
  good: number; // >= this value
  atRisk: number; // >= this value, below = critical
}

export interface MoeConfig {
  siteId: string;
  weights: MoeWeights;
  reliabilityPenaltyFactor: number;
  criticalMoeThreshold: number;
  statusBands: MoeStatusBands;
  updatedAt?: Timestamp;
  updatedBy?: string;
}

export const DEFAULT_MOE_WEIGHTS: MoeWeights = {
  availability: 0.35,
  maintenanceCompliance: 0.25,
  reliability: 0.25,
  health: 0.15,
};

export const DEFAULT_MOE_CONFIG: Omit<MoeConfig, 'siteId'> = {
  weights: DEFAULT_MOE_WEIGHTS,
  reliabilityPenaltyFactor: 8,
  criticalMoeThreshold: 70,
  statusBands: {
    excellent: 85,
    good: 70,
    atRisk: 50,
  },
};

export type MoeStatus = 'excellent' | 'good' | 'at_risk' | 'critical';

export const MOE_STATUS_META: Record<MoeStatus, { label: string; color: string }> = {
  excellent: { label: 'Excellent', color: '#10B981' },
  good: { label: 'Good', color: '#84CC16' },
  at_risk: { label: 'At Risk', color: '#F59E0B' },
  critical: { label: 'Critical', color: '#EF4444' },
};

export function getMoeStatus(moe: number, bands: MoeStatusBands = DEFAULT_MOE_CONFIG.statusBands): MoeStatus {
  if (moe >= bands.excellent) return 'excellent';
  if (moe >= bands.good) return 'good';
  if (moe >= bands.atRisk) return 'at_risk';
  return 'critical';
}

export function getMoeColor(moe: number, bands?: MoeStatusBands): string {
  return MOE_STATUS_META[getMoeStatus(moe, bands)].color;
}

export function isWeightsValid(weights: MoeWeights): boolean {
  const sum = weights.availability + weights.maintenanceCompliance + weights.reliability + weights.health;
  return Math.abs(sum - 1) < 0.005;
}

export interface MoeMachineSummary {
  machineId: string;
  machineName: string;
  department: string;
  criticality: MachineCriticality;
  moeScore: number;
  availabilityScore: number;
  maintenanceComplianceScore: number;
  reliabilityScore: number;
  healthScore: number;
  breakdownCount: number;
  totalDowntimeMinutes: number;
  isCritical: boolean; // criticality 4-5 AND below threshold
}

export interface MoePlantAggregate {
  plantAverageMoe: number; // criticality-weighted
  previousPeriodMoe: number | null;
  trend: 'up' | 'down' | 'flat';
  bestMachines: MoeMachineSummary[];
  worstMachines: MoeMachineSummary[];
  criticalMachines: MoeMachineSummary[];
  allMachines: MoeMachineSummary[];
}

export interface MoeDateRange {
  start: Date;
  end: Date;
  label: string;
}

export interface MoeTrendPoint {
  date: string; // YYYY-MM-DD
  moeScore: number;
  availabilityScore: number;
  maintenanceComplianceScore: number;
  reliabilityScore: number;
  healthScore: number;
}
