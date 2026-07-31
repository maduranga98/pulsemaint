import type { Timestamp } from 'firebase/firestore';
import type { WODocument } from './workOrder';

// ---------------------------------------------------------------------------
// Trainee Programme — a structured 6-month / 1-year training programme that
// a Trainee completes month by month, each month backed by one or more
// TrainingModule assignments (see lib/training/trainingTypes.ts).
// ---------------------------------------------------------------------------

// Actual placement length in months (used for display / certificate text).
// For a preset programme this equals the preset (6 or 12); for a custom
// date-range programme it's the approximate whole-month span between
// startDate and expectedEndDate.
export type ProgrammeDuration = number;
// What the admin picked when assigning the programme: a fixed preset, or a
// custom start/end date range (trainees arrive for varying internship
// periods, so presets are a convenience, not the only option).
export type ProgrammeDurationPreset = 6 | 12 | 'custom';
export type ProgrammeStatus = 'active' | 'completed' | 'discontinued';

export interface ProgrammeMonth {
  month: number; // 1-based, 1..durationMonths
  title: string;
  moduleIds: string[];
  weekendTaskTemplate: string[]; // checklist item labels expected each weekend of this month
}

export interface TraineeProgramme {
  id: string;
  companyId: string;
  siteId: string;
  traineeId: string;
  traineeName: string;
  durationMonths: ProgrammeDuration;
  durationPreset: ProgrammeDurationPreset;
  startDate: Timestamp;
  expectedEndDate: Timestamp;
  status: ProgrammeStatus;
  months: ProgrammeMonth[];
  createdBy: string;
  createdByName: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  finalMark: number | null; // 0-100, computed at certification time
  certificateId: string | null;
  certifiedAt: Timestamp | null;
}

// ---------------------------------------------------------------------------
// Weekend Work Summary — submitted by the trainee at the end of every week,
// records a free-text summary, a checklist of expected weekend tasks, and
// file attachments.
// ---------------------------------------------------------------------------

export type WeekendSummaryReviewStatus = 'pending' | 'reviewed' | 'needs_revision';

export interface WeekendTaskEntry {
  id: string;
  description: string;
  completed: boolean;
}

export interface WeekendSummary {
  id: string;
  companyId: string;
  programmeId: string;
  traineeId: string;
  traineeName: string;
  weekEndingDate: string; // YYYY-MM-DD, the Saturday/Sunday the week ends on
  month: number; // which programme month this week falls in
  // Which programme module this knowledge write-up is about (optional — older
  // weekend-summary records predate module tagging).
  moduleId?: string | null;
  moduleName?: string | null;
  summaryText: string;
  tasks: WeekendTaskEntry[];
  attachments: WODocument[];
  submittedAt: Timestamp;
  reviewStatus: WeekendSummaryReviewStatus;
  reviewedBy: string | null;
  reviewedByName: string | null;
  reviewedAt: Timestamp | null;
  reviewComments: string;
}

// ---------------------------------------------------------------------------
// Programme Completion Certificate
// ---------------------------------------------------------------------------

export interface ProgrammeModuleResult {
  moduleId: string;
  moduleName: string;
  month: number;
  score: number; // best quiz score achieved
}

export interface TraineeProgrammeCertificate {
  id: string;
  certificateNumber: string;
  companyId: string;
  companyName: string;
  programmeId: string;
  traineeId: string;
  traineeName: string;
  traineeEmployeeId: string | null;
  durationMonths: ProgrammeDuration;
  durationPreset: ProgrammeDurationPreset;
  startDate: Timestamp;
  completedDate: Timestamp;
  moduleResults: ProgrammeModuleResult[];
  finalMark: number;
  recommendation: string;
  recommendedBy: string;
  recommendedByName: string;
  recommendedByRole: string;
  issuedAt: Timestamp;
  pdfUrl: string;
  pdfStoragePath: string;
}
