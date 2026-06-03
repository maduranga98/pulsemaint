import type { Timestamp } from 'firebase/firestore';

// ─── Enums ────────────────────────────────────────────────────────────────────

export type KaizenStatus =
  | 'RAISED'
  | 'REVIEWED'
  | 'APPROVED'
  | 'IN_PROGRESS'
  | 'IMPLEMENTED'
  | 'VERIFIED'
  | 'REJECTED'
  | 'ON_HOLD';

export type KaizenCategory =
  | 'safety'
  | 'quality'
  | 'efficiency'
  | '5s'
  | 'cost'
  | 'environment'
  | 'other';

export type KaizenPriority = 'low' | 'medium' | 'high' | 'critical';

// ─── Sub-types ────────────────────────────────────────────────────────────────

export interface KaizenComment {
  id: string;
  userId: string;
  userName: string;
  text: string;
  createdAt: Timestamp;
  isInternal: boolean;
}

export interface KaizenStateChange {
  fromStatus: KaizenStatus;
  toStatus: KaizenStatus;
  changedBy: string;
  changedByName: string;
  changedAt: Timestamp;
  notes: string;
}

// ─── Main Card ────────────────────────────────────────────────────────────────

export interface KaizenCard {
  id: string;
  title: string;
  description: string;
  problemStatement: string;
  suggestedSolution: string;
  machineId?: string;
  machineName?: string;
  area: string;
  raisedBy: string;
  raisedByName: string;
  raisedAt: Timestamp;
  category: KaizenCategory;
  priority: KaizenPriority;
  status: KaizenStatus;

  // Cost & Benefit (Factory Pro)
  estimatedCost?: number;
  estimatedBenefit?: number;
  actualCost?: number;
  actualBenefit?: number;

  // Implementation
  implementedBy: string[];
  implementedAt?: Timestamp;

  // Verification
  verifiedBy?: string;
  verifiedAt?: Timestamp;

  // Social
  votes: string[];
  voteCount: number;
  comments: KaizenComment[];

  // Media
  beforePhotos: string[];
  afterPhotos: string[];
  attachments: string[];

  // Rejection / Hold
  rejectionReason?: string;
  onHoldReason?: string;
  onHoldUntil?: string;

  // Meta
  tags: string[];
  plantId: string;
  stateHistory: KaizenStateChange[];
}

// ─── Stats ────────────────────────────────────────────────────────────────────

export interface KaizenStats {
  total: number;
  byStatus: Record<KaizenStatus, number>;
  byCategory: Record<KaizenCategory, number>;
  implementationRate: number;
  avgTimeToImplement: number;
  totalEstimatedBenefit: number;
  totalActualBenefit: number;
  topContributors: { userId: string; name: string; count: number }[];
}

export interface KaizenTrendMonth {
  month: string; // YYYY-MM
  byStatus: Partial<Record<KaizenStatus, number>>;
  total: number;
}

// ─── Status Meta ─────────────────────────────────────────────────────────────

export const KAIZEN_STATUS_META: Record<
  KaizenStatus,
  { label: string; color: string; bgColor: string; borderColor: string }
> = {
  RAISED:      { label: 'Raised',      color: '#6B7280', bgColor: '#F3F4F6', borderColor: '#9CA3AF' },
  REVIEWED:    { label: 'Reviewed',    color: '#00C2FF', bgColor: '#E0F9FF', borderColor: '#00C2FF' },
  APPROVED:    { label: 'Approved',    color: '#1A56DB', bgColor: '#EFF6FF', borderColor: '#1A56DB' },
  IN_PROGRESS: { label: 'In Progress', color: '#F59E0B', bgColor: '#FFFBEB', borderColor: '#F59E0B' },
  IMPLEMENTED: { label: 'Implemented', color: '#10B981', bgColor: '#ECFDF5', borderColor: '#10B981' },
  VERIFIED:    { label: 'Verified',    color: '#8B5CF6', bgColor: '#F5F3FF', borderColor: '#8B5CF6' },
  REJECTED:    { label: 'Rejected',    color: '#EF4444', bgColor: '#FEF2F2', borderColor: '#EF4444' },
  ON_HOLD:     { label: 'On Hold',     color: '#F59E0B', bgColor: '#FFFBEB', borderColor: '#F59E0B' },
};

export const KAIZEN_CATEGORY_META: Record<
  KaizenCategory,
  { label: string; icon: string; color: string }
> = {
  safety:      { label: 'Safety',      icon: '🔴', color: '#EF4444' },
  quality:     { label: 'Quality',     icon: '🔵', color: '#1A56DB' },
  efficiency:  { label: 'Efficiency',  icon: '🟢', color: '#10B981' },
  '5s':        { label: '5S',          icon: '⭐', color: '#F59E0B' },
  cost:        { label: 'Cost',        icon: '💰', color: '#8B5CF6' },
  environment: { label: 'Environment', icon: '🌿', color: '#10B981' },
  other:       { label: 'Other',       icon: '📋', color: '#6B7280' },
};

export const KAIZEN_PRIORITY_META: Record<
  KaizenPriority,
  { label: string; color: string; bgColor: string }
> = {
  low:      { label: 'Low',      color: '#6B7280', bgColor: '#F3F4F6' },
  medium:   { label: 'Medium',   color: '#1A56DB', bgColor: '#EFF6FF' },
  high:     { label: 'High',     color: '#F59E0B', bgColor: '#FFFBEB' },
  critical: { label: 'Critical', color: '#EF4444', bgColor: '#FEF2F2' },
};

// Valid forward transitions in the lifecycle
export const VALID_TRANSITIONS: Partial<Record<KaizenStatus, KaizenStatus[]>> = {
  RAISED:      ['REVIEWED', 'REJECTED', 'ON_HOLD'],
  REVIEWED:    ['APPROVED', 'REJECTED', 'ON_HOLD'],
  APPROVED:    ['IN_PROGRESS', 'REJECTED', 'ON_HOLD'],
  IN_PROGRESS: ['IMPLEMENTED', 'ON_HOLD'],
  IMPLEMENTED: ['VERIFIED', 'ON_HOLD'],
  ON_HOLD:     ['RAISED', 'REVIEWED', 'APPROVED', 'IN_PROGRESS', 'IMPLEMENTED'],
};
