import type { Timestamp } from 'firebase/firestore';

// ─── Categories & Answer Types ──────────────────────────────────────────────

/**
 * The 4 categories that ship built-in with the app. `AuditCategory` itself is
 * a plain string so admins can create additional, site-defined categories
 * (see `AuditTemplate.category`) without a code change — the built-in IDs
 * below are just well-known values with dedicated labels/icons.
 */
export const BUILTIN_AUDIT_CATEGORIES = ['tpm', 'fives', 'moe', 'contractor'] as const;
export type BuiltinAuditCategory = (typeof BUILTIN_AUDIT_CATEGORIES)[number];

export type AuditCategory = string;

export const AUDIT_CATEGORY_LABELS: Record<BuiltinAuditCategory, string> = {
  tpm: 'TPM Audit',
  fives: '5S Audit',
  moe: 'MOE Audit',
  contractor: 'Contractor Audit',
};

/** Human-readable label for a category: built-in label if known, otherwise the template/fallback name. */
export function getCategoryLabel(category: AuditCategory, fallbackName?: string): string {
  return (AUDIT_CATEGORY_LABELS as Record<string, string>)[category] ?? fallbackName ?? category;
}

export function isBuiltinCategory(category: string): category is BuiltinAuditCategory {
  return (BUILTIN_AUDIT_CATEGORIES as readonly string[]).includes(category);
}

export const ALL_FINDING_KINDS: FindingKind[] = ['loss', 'breakdown', 'safety', 'maintenance'];

/**
 * Normalizes a template read from Firestore so every consumer can treat
 * `scope` and `enabledFindingKinds` as always-present, regardless of whether
 * the underlying document predates those fields. `scope` is derived from the
 * legacy `category === 'contractor'` convention to preserve current
 * behavior exactly; `enabledFindingKinds` defaults to all 4 kinds.
 */
export function normalizeTemplate<T extends { category: AuditCategory; scope?: AuditScope; enabledFindingKinds?: FindingKind[] }>(
  template: T,
): T & { scope: AuditScope; enabledFindingKinds: FindingKind[] } {
  return {
    ...template,
    scope: template.scope ?? (template.category === 'contractor' ? 'contractors' : 'machines'),
    enabledFindingKinds: template.enabledFindingKinds ?? ALL_FINDING_KINDS,
  };
}

/** Answer types selectable per task when configuring an audit template. */
export type AnswerType = 'yes_no' | 'scale' | 'text';

export const ANSWER_TYPE_LABELS: Record<AnswerType, string> = {
  yes_no: 'Yes / No',
  scale: 'Scale (0–5)',
  text: 'Text',
};

export type AuditStatus = 'draft' | 'submitted';

/**
 * What a template's checklist is "about" — drives which item picker (if any)
 * and Department/Location behavior the session form renders. Explicit and
 * admin-selectable at category-creation time (see `AuditTaskConfigurator`
 * `createNew` mode); not editable afterwards since it drives the session UI.
 */
export type AuditScope = 'machines' | 'contractors' | 'inventory' | 'workOrders' | 'departments';

export const AUDIT_SCOPE_LABELS: Record<AuditScope, string> = {
  machines: 'Machines',
  contractors: 'Contractors',
  inventory: 'Inventory / Parts',
  workOrders: 'Work Orders',
  departments: 'Departments',
};

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
  /**
   * What this template's checklist is scoped to. Optional on the type only to
   * model documents persisted before this field existed — always read
   * templates through `normalizeTemplate()` so callers can treat this as
   * required. New/created templates always set it explicitly.
   */
  scope?: AuditScope;
  /**
   * Which Finding types (Losses/Breakdowns/Safety/Maintenance) this
   * template's session form offers. Optional for the same backward-compat
   * reason as `scope` — read via `normalizeTemplate()`.
   */
  enabledFindingKinds?: FindingKind[];
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

export interface ContractorRef {
  id: string;
  name: string;
}

export interface InventoryItemRef {
  id: string;
  name: string;
  partNumber?: string;
}

export interface WorkOrderRef {
  id: string;
  woNumber: string;
  machineName?: string;
}

/** A single per-job rating + note captured during a Contractor Audit. */
export interface ContractorJobRating {
  jobId: string;
  workOrderNumber: string;
  contractorId: string;
  contractorName: string;
  rating: number;
  notes: string;
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
  contractors: ContractorRef[];
  /** Denormalized contractor ids for `array-contains` queries (Contractor Audits only). */
  contractorIds: string[];
  inventoryItems: InventoryItemRef[];
  workOrders: WorkOrderRef[];
  department: string;
  location: string;

  /** Per-job star rating + notes captured during a Contractor Audit (empty for other categories). */
  contractorJobRatings: ContractorJobRating[];

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
  /** userId_category — deterministic, so one in-progress audit per person per category. */
  id: string;
  userId: string;
  userName: string;
  category: AuditCategory;
  templateId: string;
  templateName: string;
  machines: MachineRef[];
  contractors: ContractorRef[];
  inventoryItems: InventoryItemRef[];
  workOrders: WorkOrderRef[];
  department: string;
  location: string;
  contractorJobRatings: ContractorJobRating[];
  participants: AuditParticipant[];
  answers: Record<string, AuditAnswer>;
  findings: AuditFinding[];
  startedAt: string;
  lastSaved: string;
}
