import type { Timestamp } from 'firebase/firestore';

// ---------------------------------------------------------------------------
// Training Program — a flat list of Trainee Management library modules, each
// with its own due duration (days from assignment), plus one overall program
// duration. Deliberately simple: no monthly structure, no weekend summaries.
// ---------------------------------------------------------------------------

export interface ProgramModuleConfig {
  moduleId: string;
  moduleName: string;
  /** Days from the assignment date this module is due. */
  dueDays: number;
}

export type TrainingProgramStatus = 'active' | 'archived';

export interface TrainingProgram {
  id: string;
  companyId: string;
  title: string;
  description: string;
  moduleConfigs: ProgramModuleConfig[];
  /** Overall program duration, in days, from the assignment date. */
  totalDurationDays: number;
  status: TrainingProgramStatus;
  createdBy: string;
  createdByName: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ---------------------------------------------------------------------------
// Program Assignment — one trainee assigned to one program. Tracks the
// underlying per-module trainingAssignments and the sign-off/certificate
// once every module is complete.
// ---------------------------------------------------------------------------

export type ProgramAssignmentStatus = 'in_progress' | 'completed' | 'signed_off';

export interface ProgramCertificateModuleResult {
  moduleId: string;
  moduleName: string;
  score: number;
}

export interface ProgramSignOff {
  signedOffBy: string;
  signedOffByName: string;
  signedOffByRole: string;
  note: string;
  signedOffAt: Timestamp;
}

export interface ProgramCertificate {
  certificateNumber: string;
  moduleResults: ProgramCertificateModuleResult[];
  issuedAt: Timestamp;
  /** The signing-off manager's captured signature, drawn onto the certificate PDF. */
  signatureImageDataUrl?: string | null;
}

export interface ProgramAssignment {
  id: string;
  companyId: string;
  programId: string;
  programName: string;
  traineeId: string;
  traineeName: string;
  assignedBy: string;
  assignedByName: string;
  assignedAt: Timestamp;
  dueDate: Timestamp;
  /** The individual trainingAssignments doc IDs backing this program's modules. */
  moduleAssignmentIds: string[];
  status: ProgramAssignmentStatus;
  signOff: ProgramSignOff | null;
  certificate: ProgramCertificate | null;
}
