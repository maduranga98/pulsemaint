import type { Timestamp } from 'firebase/firestore';
import type {
  TrainingModule,
  TrainingAssignment,
  TrainingModuleCategory,
} from './trainingTypes';

// ---------------------------------------------------------------------------
// Default question bank — editable/addable by the assigner when building an
// offboard/external training module.
// ---------------------------------------------------------------------------

export const DEFAULT_OFFBOARD_QUESTIONS: string[] = [
  'What are the top 3 things you learned in this training?',
  'How does this training apply to your current role or machine(s) you work on?',
  'Did you receive any documentation, manuals, or reference material? If yes, list them (attach separately).',
  'Were there any new safety procedures or standards introduced?',
  'Is there a follow-up certification, license, or renewal required? If yes, when?',
  'Would you recommend this training/provider to other employees? Why or why not?',
  'What, if anything, should the company do differently before sending someone else to this training?',
  'Describe one specific improvement you can make to your current work based on this training.',
];

// Small static list — good enough for a searchable <select>, not meant to be
// an exhaustive ISO-3166 list.
export const OFFBOARD_COUNTRIES: string[] = [
  'Sri Lanka', 'India', 'Singapore', 'Malaysia', 'Thailand', 'China',
  'Japan', 'South Korea', 'United Arab Emirates', 'Saudi Arabia',
  'United Kingdom', 'Germany', 'France', 'Italy', 'Netherlands',
  'United States', 'Canada', 'Australia', 'South Africa', 'Other',
];

export const OFFBOARD_MODE_LABELS: Record<string, string> = {
  'in-person': 'In-person',
  online: 'Online',
  hybrid: 'Hybrid',
};

/**
 * `category` was added after the module was first launched — existing
 * Firestore docs have no `category` field at all. Every read path must
 * treat a missing category as 'machine' rather than crashing/branching
 * incorrectly.
 */
export function getModuleCategory(
  module: Pick<TrainingModule, 'category'> | null | undefined
): TrainingModuleCategory {
  return module?.category === 'offboard' ? 'offboard' : 'machine';
}

export function getAssignmentCategory(
  assignment: Pick<TrainingAssignment, 'category'> | null | undefined
): TrainingModuleCategory {
  return assignment?.category === 'offboard' ? 'offboard' : 'machine';
}

export function isOffboardModule(
  module: Pick<TrainingModule, 'category'> | null | undefined
): boolean {
  return getModuleCategory(module) === 'offboard';
}

export function isOffboardAssignment(
  assignment: Pick<TrainingAssignment, 'category'> | null | undefined
): boolean {
  return getAssignmentCategory(assignment) === 'offboard';
}

function toDate(value: Timestamp | Date | string | null | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'string') {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof (value as Timestamp).toDate === 'function') {
    return (value as Timestamp).toDate();
  }
  return null;
}

/**
 * Inclusive day count between start and end (a training that starts and
 * ends the same day is 1 day). Returns 0 when either date is missing/invalid.
 */
export function computeDurationDays(
  startDate: Timestamp | Date | string | null | undefined,
  endDate: Timestamp | Date | string | null | undefined
): number {
  const start = toDate(startDate);
  const end = toDate(endDate);
  if (!start || !end) return 0;
  const startMidnight = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const endMidnight = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  const diffMs = endMidnight.getTime() - startMidnight.getTime();
  if (diffMs < 0) return 0;
  return Math.round(diffMs / 86400000) + 1;
}

export function isOffboardCompletionValid(completion: {
  knowledgeGained?: string;
  assessmentAnswers?: { question: string; answer: string }[];
} | null | undefined): boolean {
  if (!completion) return false;
  if (!completion.knowledgeGained || completion.knowledgeGained.trim().length === 0) {
    return false;
  }
  return true;
}

export function isOffboardReportOverdue(
  endDate: Timestamp | Date | string | null | undefined,
  reportSubmittedAt: Timestamp | Date | string | null | undefined,
  now: Date = new Date()
): boolean {
  if (reportSubmittedAt) return false;
  const end = toDate(endDate);
  if (!end) return false;
  return end.getTime() < now.getTime();
}

export function daysOverdue(
  endDate: Timestamp | Date | string | null | undefined,
  now: Date = new Date()
): number {
  const end = toDate(endDate);
  if (!end) return 0;
  const diffMs = now.getTime() - end.getTime();
  if (diffMs <= 0) return 0;
  return Math.floor(diffMs / 86400000);
}
