import type { Timestamp } from 'firebase/firestore';

export type TPMPillarId = 'AM' | 'PM' | 'QM' | 'FI' | 'EEM' | 'TE' | 'SHE' | 'OTPM';

export type TPMPillarTrend = 'up' | 'down' | 'stable';

export interface TPMPillar {
  id: TPMPillarId;
  name: string;
  icon: string;
  score: number; // 0-100
  trend: TPMPillarTrend;
  lastUpdated: Timestamp | null;
  actionPlan: string;
  responsible: string | null; // userId
}

export interface TPMScore {
  composite: number;
  pillars: TPMPillar[];
  calculatedAt: Timestamp;
  plantId: string;
}

export type AMTaskFrequency = 'daily' | 'weekly' | 'monthly';
export type AMTaskStatus = 'pending' | 'done' | 'overdue';
export type AMTaskShift = 'day' | 'evening' | 'night';

export interface AMTask {
  id: string;
  machineId: string;
  machineName: string;
  taskDescription: string;
  frequency: AMTaskFrequency;
  assignedTo: string | null; // userId
  dueDate: string; // ISO date YYYY-MM-DD
  completedAt: Timestamp | null;
  completedBy: string | null; // userId
  status: AMTaskStatus;
  shift: AMTaskShift;
}

export type TPMMaturityLevel = 1 | 2 | 3 | 4;

export const TPM_MATURITY_LABELS: Record<TPMMaturityLevel, string> = {
  1: 'Reactive',
  2: 'Preventive',
  3: 'Predictive',
  4: 'Zero Breakdown',
};

export const TPM_MATURITY_DESCRIPTIONS: Record<TPMMaturityLevel, string> = {
  1: 'Fixing failures after they occur. No structured maintenance plan.',
  2: 'Scheduled maintenance prevents most failures. AM tasks in place.',
  3: 'Data-driven approach. Condition monitoring and early fault detection.',
  4: 'Near-zero unplanned downtime. Continuous improvement culture embedded.',
};

export interface TPMMachineScore {
  machineId: string;
  machineName: string;
  maturityLevel: TPMMaturityLevel;
  pillarScores: Partial<Record<TPMPillarId, number>>;
  oeeScore: number | null;
  lastAssessed: Timestamp | null;
  nextLevelCriteria: string;
  actionRequired: string;
}

export interface TPMMonthlyScore {
  month: string; // YYYY-MM
  composite: number;
  pillars: Partial<Record<TPMPillarId, number>>;
  calculatedAt: Timestamp;
}

export const PILLAR_WEIGHTS: Record<TPMPillarId, number> = {
  AM: 0.15,
  PM: 0.20,
  QM: 0.15,
  FI: 0.10,
  EEM: 0.10,
  TE: 0.15,
  SHE: 0.10,
  OTPM: 0.05,
};

export const PILLAR_META: Record<TPMPillarId, { name: string; icon: string; description: string }> = {
  AM: {
    name: 'Autonomous Maintenance',
    icon: '🔧',
    description: 'Operators take ownership of basic maintenance tasks, cleaning, inspection, and lubrication.',
  },
  PM: {
    name: 'Planned Maintenance',
    icon: '📅',
    description: 'Scheduled maintenance activities to prevent failures and extend equipment life.',
  },
  QM: {
    name: 'Quality Maintenance',
    icon: '🎯',
    description: 'Eliminate sources of quality defects and maintain zero-defect conditions.',
  },
  FI: {
    name: 'Focused Improvement',
    icon: '💡',
    description: 'Systematic elimination of losses and waste through cross-functional teams.',
  },
  EEM: {
    name: 'Early Equipment Management',
    icon: '🏗',
    description: 'Incorporate maintenance knowledge into new equipment design and procurement.',
  },
  TE: {
    name: 'Training & Education',
    icon: '🎓',
    description: 'Build skills and knowledge across all levels for a maintenance-capable workforce.',
  },
  SHE: {
    name: 'Safety, Health & Environment',
    icon: '🛡',
    description: 'Achieve zero accidents through rigorous safety standards and culture.',
  },
  OTPM: {
    name: 'Office TPM',
    icon: '📊',
    description: 'Extend TPM principles to administrative and support functions.',
  },
};
