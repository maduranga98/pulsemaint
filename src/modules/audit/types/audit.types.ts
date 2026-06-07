import type { Timestamp } from 'firebase/firestore';

// ─── Categories & Answer Types ──────────────────────────────────────────────

export type AuditCategory = 'tpm' | 'fives' | 'oee' | 'contractor';

export const AUDIT_CATEGORY_LABELS: Record<AuditCategory, string> = {
  tpm: 'TPM Audit',
  fives: '5S Audit',
  oee: 'OEE Audit',
  contractor: 'Contractor Audit',
};

/** Answer types selectable per task when configuring an audit template. */
export type AnswerType = 'yes_no' | 'scale' | 'text';

export const ANSWER_TYPE_LABELS: Record<AnswerType, string> = {
  yes_no: 'Yes / No',
  scale: 'Scale (0–5)',
  text: 'Text',
};

export type AuditStatus = 'draft' | 'submitted';

/** Finding kinds that always prompt for a reason + corrective solution. */
export type FindingKind = 'loss' | 'breakdown' | 'safety' | 'maintenance';

export const FINDING_KIND_LABELS: Record<FindingKind, string> = {
  loss: 'Production Loss',
  breakdown: 'Breakdown',
  safety: 'Safety Issue',
  maintenance: 'Maintenance Issue',
};

// ─── Template / Configurable Tasks ──────────────────────────────────────────

export interface AuditTask {
  id: string;
  /** Question / check description shown to the auditor. */
  text: string;
  answerType: AnswerType;
  /** When true, a failing answer (No / low score) requires a reason + solution. */
  critical: boolean;
}

export interface AuditTemplate {
  id: string;
  category: AuditCategory;
  name: string;
  tasks: AuditTask[];
  plantId: string;
  /** A built-in default template ships with the app and can be cloned/edited. */
  isDefault: boolean;
  updatedAt: Timestamp | null;
}

// ─── Session sub-records ────────────────────────────────────────────────────

export interface AuditAnswer {
  taskId: string;
  taskText: string;
  answerType: AnswerType;
  /** 'yes'|'no' for yes_no, '0'..'5' for scale, free text for text. */
  value: string;
  notes: string;
  /** True when this answer represents a failing/non-conforming result. */
  failed: boolean;
}

export interface AuditFinding {
  id: string;
  kind: FindingKind;
  description: string;
  reason: string;
  solution: string;
  /** Optional task this finding is linked to. */
  taskId?: string;
}

export type AttachmentType = 'document' | 'image' | 'video';

export interface AuditAttachment {
  id: string;
  type: AttachmentType;
  name: string;
  url: string;
  mimeType: string;
  size: number;
}

export interface AuditParticipant {
  userId: string;
  name: string;
  role: string;
}

export interface MachineRef {
  id: string;
  name: string;
}

export interface AIRootCauseSuggestion {
  findingId: string;
  findingDescription: string;
  kind: FindingKind;
  probableCauses: string[];
  recommendedActions: string[];
  discipline: 'maintenance' | 'safety' | 'operations' | 'quality';
  priority: 'high' | 'medium' | 'low';
}

// ─── Audit Session ──────────────────────────────────────────────────────────

export interface AuditSession {
  id: string;
  category: AuditCategory;
  templateId: string;
  templateName: string;

  // Scope
  machines: MachineRef[];
  department: string;
  location: string;

  // Auto-captured auditor (logged-in user)
  auditorId: string;
  auditorName: string;
  auditorEmployeeId: string;
  auditorRole: string;

  participants: AuditParticipant[];

  // Results
  answers: AuditAnswer[];
  findings: AuditFinding[];
  attachments: AuditAttachment[];
  aiSuggestions: AIRootCauseSuggestion[];

  score: number; // 0-100
  totalTasks: number;
  passedTasks: number;

  status: AuditStatus;
  reportUrl: string | null;

  plantId: string;
  auditDate: string; // YYYY-MM-DD
  createdAt: Timestamp | null;
  submittedAt: Timestamp | null;
}

/** Draft persisted to localStorage while an audit is in progress. */
export interface AuditDraft {
  category: AuditCategory;
  templateId: string;
  machines: MachineRef[];
  department: string;
  location: string;
  participants: AuditParticipant[];
  answers: Record<string, AuditAnswer>;
  findings: AuditFinding[];
  lastSaved: string;
}
