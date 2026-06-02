import type { Timestamp } from 'firebase/firestore';

export type OEEShift = 'day' | 'evening' | 'night';
export type OEEDataSource = 'manual' | 'semi-auto';
export type BigLossCategory =
  | 'breakdown'
  | 'setup'
  | 'minor_stoppage'
  | 'reduced_speed'
  | 'startup_rejects'
  | 'production_rejects';

export interface OEERecord {
  id: string;
  machineId: string;
  machineName: string;
  shiftDate: string; // YYYY-MM-DD
  shift: OEEShift;
  plannedProductionTime: number; // minutes
  actualDowntime: number; // minutes
  actualOutput: number;
  targetOutput: number;
  goodOutput: number;
  totalOutput: number;
  availability: number; // %
  performance: number; // %
  quality: number; // %
  oee: number; // %
  dataSource: OEEDataSource;
  linkedBreakdownIds: string[];
  enteredBy: string;
  enteredAt: Timestamp;
  plantId: string;
  department?: string;
}

export interface OEETrendMonth {
  month: string; // YYYY-MM
  oee: number;
  availability: number;
  performance: number;
  quality: number;
}

export interface OEETrend {
  machineId: string;
  monthly: OEETrendMonth[];
}

export interface BigLoss {
  category: BigLossCategory;
  label: string;
  hours: number;
  percentage: number;
  lkrCost: number;
  color: string;
}

export interface ShiftOEEComparison {
  shift: OEEShift;
  avgOEE: number;
  avgAvailability: number;
  avgPerformance: number;
  avgQuality: number;
  recordCount: number;
}

export interface OEETarget {
  machineId: string;
  targetOEE: number; // default 85
  targetAvailability: number;
  targetPerformance: number;
  targetQuality: number;
  lkrPerHour: number;
}

export interface OEEMonthlyAggregate {
  month: string;
  avgOEE: number;
  avgAvailability: number;
  avgPerformance: number;
  avgQuality: number;
  recordCount: number;
}

export interface MachineSummary {
  machineId: string;
  machineName: string;
  department: string;
  latestOEE: number | null;
  latestAvailability: number | null;
  latestPerformance: number | null;
  latestQuality: number | null;
  latestRecord: OEERecord | null;
}

export const BIG_LOSS_META: Record<BigLossCategory, { label: string; color: string }> = {
  breakdown: { label: 'Breakdown Losses', color: '#EF4444' },
  setup: { label: 'Setup & Adjustment', color: '#F59E0B' },
  minor_stoppage: { label: 'Minor Stoppages', color: '#F97316' },
  reduced_speed: { label: 'Reduced Speed', color: '#8B5CF6' },
  startup_rejects: { label: 'Startup Rejects', color: '#00C2FF' },
  production_rejects: { label: 'Production Rejects', color: '#1A56DB' },
};

export const OEE_STATUS = {
  worldClass: { min: 85, label: 'World Class', color: '#10B981' },
  belowTarget: { min: 65, label: 'Below Target', color: '#F59E0B' },
  critical: { min: 0, label: 'Critical', color: '#EF4444' },
} as const;

export function getOEEStatus(oee: number): { label: string; color: string } {
  if (oee >= 85) return OEE_STATUS.worldClass;
  if (oee >= 65) return OEE_STATUS.belowTarget;
  return OEE_STATUS.critical;
}

export function getOEEColor(oee: number): string {
  if (oee >= 85) return '#10B981';
  if (oee >= 65) return '#F59E0B';
  return '#EF4444';
}
