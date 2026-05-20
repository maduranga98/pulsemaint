import type { Timestamp } from 'firebase/firestore';

export type TriageLanguage = 'en' | 'si' | 'ta' | 'bn';
export type TriageStepPhase = 'safety' | 'assessment' | 'safe_action' | 'document' | 'wait';
export type TriageStepType =
  | 'statement'
  | 'yes_no'
  | 'multiple_choice'
  | 'photo_required'
  | 'number_input'
  | 'text_input'
  | 'checklist';
export type TriageSafetyLevel = 'safe' | 'caution' | 'danger';
export type TriageSessionStatus =
  | 'in_progress'
  | 'completed'
  | 'escalated'
  | 'quick_fix'
  | 'abandoned';
export type TriageOutcomeType =
  | 'resolved_by_operator'
  | 'repair_team_required'
  | 'emergency_escalated'
  | 'machine_shutdown'
  | 'abandoned';

export interface TriageStepOption {
  id: string;
  label: string;
  nextStepId: string | null;
  isEscalate: boolean;
  isSafe: boolean;
  translations?: Record<string, { label: string }>;
}

export interface TriageChecklistItem {
  id: string;
  text: string;
  required: boolean;
}

export interface TriageMediaRef {
  type: 'image' | 'video';
  url: string;
  caption: string;
}

export interface TriageStepTranslation {
  title: string;
  instruction: string;
}

export interface TriageStep {
  id: string;
  stepNumber: number;
  phase: TriageStepPhase;
  title: string;
  instruction: string;
  type: TriageStepType;
  options: TriageStepOption[];
  checklistItems: TriageChecklistItem[];
  mediaRefs: TriageMediaRef[];
  safetyLevel: TriageSafetyLevel;
  isEscalationStep: boolean;
  isQuickFixStep: boolean;
  requiresPhoto: boolean;
  requiresConfirmation: boolean;
  translations: Record<string, TriageStepTranslation>;
  estimatedSeconds: number;
  fieldLabel?: string;
  unit?: string;
  normalMin?: number;
  normalMax?: number;
  placeholder?: string;
  maxChars?: number;
}

export interface TriageEmergencyContact {
  name: string;
  phone: string;
  role: string;
}

export interface TriageFlow {
  id: string;
  companyId: string;
  name: string;
  description: string;
  machineTypeId: string | null;
  specificMachineId: string | null;
  language: TriageLanguage;
  isTemplate: boolean;
  isActive: boolean;
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  updatedBy: string;
  steps: TriageStep[];
  emergencyContacts: TriageEmergencyContact[];
  machineShutdownProcedure: string;
  totalEstimatedMinutes: number;
  usageCount: number;
  lastUsedAt: Timestamp | null;
}

export interface TriageStepLog {
  stepId: string;
  stepNumber: number;
  phase: string;
  title: string;
  completedAt: Timestamp;
  durationSeconds: number;
  response: boolean | string | string[] | number | null;
  photoUrls: string[];
  notes: string;
  skipped: boolean;
  skipReason: string;
}

export interface TriageSession {
  id: string;
  companyId: string;
  breakdownTicketId: string | null;
  machineId: string;
  machineName: string;
  flowId: string;
  flowName: string;
  status: TriageSessionStatus;
  language: TriageLanguage;
  supervisorId: string;
  supervisorName: string;
  startedAt: Timestamp;
  completedAt: Timestamp | null;
  totalDuration: number;
  currentStepId: string;
  currentStepNumber: number;
  stepLogs: TriageStepLog[];
  photosCaptured: string[];
  outcomeType: TriageOutcomeType | null;
  outcomeNotes: string;
  escalatedAt: Timestamp | null;
  escalatedReason: string;
  quickFixDescription: string;
  isDemo: boolean;
}
