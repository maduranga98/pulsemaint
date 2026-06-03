import type { Timestamp } from 'firebase/firestore';

export type AuditFrequency = 'daily' | 'weekly' | 'monthly';
export type AuditShift = 'day' | 'evening' | 'night';
export type AuditStatus = 'draft' | 'submitted' | 'verified';
export type CorrectiveActionStatus = 'open' | 'in_progress' | 'closed';
export type CorrectiveActionSeverity = 'immediate' | 'standard';
export type PillarId = 'sort' | 'set_in_order' | 'shine' | 'standardize' | 'sustain';
export type AuditLanguage = 'en' | 'si' | 'ta';

export interface AuditZone {
  id: string;
  name: string;
  description: string;
  department: string;
  floorLocation: string;
  responsibleUserId: string;
  assignedAuditors: string[];
  auditFrequency: AuditFrequency;
  lastAuditDate: string | null;
  lastAuditScore: number | null;
  isActive: boolean;
  plantId: string;
}

export interface FiveSCheckItem {
  id: string;
  pillarId: PillarId;
  description: string;
  sinhalaDescription: string;
  tamilDescription: string;
}

export interface FiveSPillar {
  id: PillarId;
  name: string;
  sinhalaName: string;
  tamilName: string;
  icon: string;
  checklistItems: FiveSCheckItem[];
}

export interface AuditItemScore {
  checkItemId: string;
  score: 0 | 1 | 2 | 3 | 4;
  notes: string;
  photoUrls: string[];
  requiresAction: boolean;
}

export interface FiveSAudit {
  id: string;
  zoneId: string;
  zoneName: string;
  auditDate: string;
  shift: AuditShift;
  auditorId: string;
  auditorName: string;
  coAuditorName?: string;
  pillarScores: Record<PillarId, number>;
  overallScore: number;
  itemScores: AuditItemScore[];
  totalItems: number;
  scoredItems: number;
  status: AuditStatus;
  correctiveActions: string[];
  submittedAt: Timestamp | null;
  verifiedAt: Timestamp | null;
  verifiedBy: string | null;
  plantId: string;
  language: AuditLanguage;
}

export interface CorrectiveAction {
  id: string;
  auditId: string;
  zoneId: string;
  zoneName: string;
  checkItemId: string;
  checkItemDescription: string;
  pillarId: PillarId;
  description: string;
  severity: CorrectiveActionSeverity;
  assignedTo: string;
  dueDate: string;
  status: CorrectiveActionStatus;
  closureNotes: string;
  closurePhotos: string[];
  closedAt: Timestamp | null;
  closedBy: string | null;
  plantId: string;
  createdAt: Timestamp | null;
}

export interface AuditDraft {
  zoneId: string;
  zoneName: string;
  auditDate: string;
  shift: AuditShift;
  auditorId: string;
  auditorName: string;
  coAuditorName: string;
  language: AuditLanguage;
  itemScores: Record<string, AuditItemScore>;
  currentStep: number;
  lastSaved: string;
  plantId: string;
}
