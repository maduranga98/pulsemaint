import type { Timestamp } from 'firebase/firestore';

// ---------------------------------------------------------------------------
// Enumerations / Union Types
// ---------------------------------------------------------------------------

export type TrainingModuleStatus = 'draft' | 'active' | 'archived';
export type LessonType = 'video' | 'document' | 'image_gallery' | 'text';
export type QuestionType = 'single_choice' | 'multiple_choice' | 'true_false';
export type AssignmentStatus =
  | 'not_started'
  | 'in_progress'
  | 'quiz_passed'
  | 'quiz_failed'
  | 'awaiting_practical'
  | 'certified'
  | 'expired'
  | 'retraining_required';
export type TrainingLanguage = 'en' | 'si' | 'ta' | 'bn';
export type ContentLibraryItemType = 'video' | 'document' | 'image';
/**
 * `machine` — the traditional in-house, machine-specific training module.
 * `offboard_external` — training delivered off-site or by an external
 * provider (e.g. a vendor certification course, an external safety
 * workshop) that isn't tied to a specific machine in the registry.
 */
export type ModuleCategory = 'machine' | 'offboard_external';

// Category distinguishes in-house machine-specific training from
// offboard/external training run by a third party. Existing docs predate
// this field and have no `category` set — treat missing as 'machine'
// everywhere (see getModuleCategory in offboardTraining.ts).
export type TrainingModuleCategory = 'machine' | 'offboard';
export type OffboardTrainingMode = 'in-person' | 'online' | 'hybrid';

// ---------------------------------------------------------------------------
// Lesson
// ---------------------------------------------------------------------------

export interface LessonItem {
  id: string;
  order: number;
  title: string;
  type: LessonType;
  contentUrl: string;
  thumbnailUrl: string;
  description: string;
  durationSeconds: number;
  pageCount: number;
  isRequired: boolean;
  subtitleUrl: string;
  /** Scheduled delivery date, 'YYYY-MM-DD'. Optional — legacy lessons have none. */
  scheduledDate?: string;
  /** Scheduled delivery time, 'HH:mm' (24h). Optional — legacy lessons have none. */
  scheduledTime?: string;
}

// ---------------------------------------------------------------------------
// Quiz
// ---------------------------------------------------------------------------

export interface QuizOption {
  id: string;
  text: string;
  isCorrect: boolean;
  explanation: string;
}

export interface QuizQuestion {
  id: string;
  order: number;
  text: string;
  type: QuestionType;
  imageUrl: string;
  options: QuizOption[];
  points: number;
  explanation: string;
}

export interface TrainingQuiz {
  id: string;
  title: string;
  instructions: string;
  /** Duration allotted, in minutes. 0 = no limit. */
  timeLimit: number;
  maxAttempts: number;
  passingScore: number;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  questions: QuizQuestion[];
  /** Scheduled date/time for a practice quiz or the final test, 'YYYY-MM-DD' / 'HH:mm'. */
  scheduledDate?: string;
  scheduledTime?: string;
  /** True for the module's final test (as opposed to a practice quiz). */
  isFinalTest?: boolean;
}

// ---------------------------------------------------------------------------
// Trainee-specific categorisation (Trainee Management assignment flow)
// ---------------------------------------------------------------------------

/** The six trainee-programme categories used to seed sample modules and to
 * classify a module/assignment for the "Training Type" picker. */
export type TraineeTrainingType =
  | 'electrical_trainee'
  | 'mechanical_trainee'
  | 'hr_trainee'
  | 'civil_trainee'
  | 'technician_trainee'
  | 'operator_trainee';

export const TRAINEE_TRAINING_TYPE_LABELS: Record<TraineeTrainingType, string> = {
  electrical_trainee: 'Electrical Trainee',
  mechanical_trainee: 'Mechanical Trainee',
  hr_trainee: 'HR Trainee',
  civil_trainee: 'Civil Trainee',
  technician_trainee: 'Technician Trainee',
  operator_trainee: 'Operator Trainee',
};

// ---------------------------------------------------------------------------
// Offboard / External Training
// ---------------------------------------------------------------------------

export interface OffboardTrainingDetails {
  country: string;
  thirdPartyCompany: string;
  thirdPartyContactName: string;
  thirdPartyContactInfo: string;
  mode: OffboardTrainingMode;
  startDate: Timestamp | null;
  endDate: Timestamp | null;
  durationDays: number;
  topic: string;
  linkedMachineId: string | null;
  assessmentQuestions: string[];
}

// ---------------------------------------------------------------------------
// Training Module
// ---------------------------------------------------------------------------

export interface TrainingModule {
  id: string;
  companyId: string;
  title: string;
  description: string;
  moduleCategory?: ModuleCategory;
  machineId: string | null;
  machineTypeId: string | null;
  machineName: string;
  /** Only set when moduleCategory === 'offboard_external'. */
  providerName?: string;
  providerContact?: string;
  trainingLocation?: string;
  externalCertificateUrl?: string;
  coverImageUrl: string;
  estimatedMinutes: number;
  passingScore: number;
  status: TrainingModuleStatus;
  language: TrainingLanguage;
  version: number;
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  updatedBy: string;
  lessons: LessonItem[];
  /** The final test — passing this (existing completion/certificate pipeline) certifies the module. */
  quiz: TrainingQuiz | null;
  /** Optional practice quiz shown before the final test; does not gate completion. */
  practiceQuiz?: TrainingQuiz | null;
  tags: string[];
  prerequisiteModuleIds: string[];
  usageCount: number;
  completionCount: number;
  // Optional: absent on legacy docs — treat as 'machine' when reading.
  category?: TrainingModuleCategory;
  offboardDetails?: OffboardTrainingDetails | null;
  /** Trainee-programme category (Electrical/Mechanical/HR/Civil/Technician/Operator Trainee). */
  trainingType?: TraineeTrainingType;
  /** Default training period, in months, applied when this module is assigned to a trainee (e.g. 6). */
  defaultTrainingPeriodMonths?: number;
}

// ---------------------------------------------------------------------------
// Assignment Progress
// ---------------------------------------------------------------------------

export interface LessonProgress {
  completed: boolean;
  completedAt: Timestamp | null;
  watchedSeconds: number;
  percentComplete: number;
}

export interface QuizAnswer {
  questionId: string;
  selectedOptionIds: string[];
  isCorrect: boolean;
  pointsEarned: number;
}

export interface QuizAttempt {
  attemptId: string;
  attemptNumber: number;
  startedAt: Timestamp;
  completedAt: Timestamp;
  score: number;
  passed: boolean;
  totalQuestions: number;
  correctAnswers: number;
  answers: QuizAnswer[];
  timeTakenSeconds: number;
}

export interface PracticalSignOff {
  required: boolean;
  signedOffBy: string;
  signedOffByName: string;
  signedOffAt: Timestamp | null;
  observations: string;
  passed: boolean;
}

// ---------------------------------------------------------------------------
// Offboard Training Completion (employee-submitted knowledge report)
// ---------------------------------------------------------------------------

export interface OffboardAssessmentAnswer {
  question: string;
  answer: string;
}

export interface OffboardCompletion {
  knowledgeGained: string;
  assessmentAnswers: OffboardAssessmentAnswer[];
  attachmentUrls: string[];
  actualStartDate: Timestamp | null;
  actualEndDate: Timestamp | null;
  reportSubmittedAt: Timestamp | null;
  reportGeneratedPdfUrl: string;
}

// ---------------------------------------------------------------------------
// Training Assignment
// ---------------------------------------------------------------------------

export interface TrainingAssignment {
  id: string;
  companyId: string;
  moduleId: string;
  moduleName: string;
  moduleCategory?: ModuleCategory;
  machineId: string;
  machineName: string;
  providerName?: string;
  traineeId: string;
  traineeName: string;
  traineeEmail: string;
  // Absent on assignments created before this field was added.
  traineeRole?: string;
  department: string;
  assignedBy: string;
  assignedByName: string;
  assignedAt: Timestamp;
  dueDate: Timestamp | null;
  status: AssignmentStatus;
  isRetraining: boolean;
  retrainingReason: string;
  retrainingTriggeredAt: Timestamp | null;
  lessonProgress: Record<string, LessonProgress>;
  overallProgress: number;
  lessonsCompleted: number;
  totalLessons: number;
  quizAttempts: QuizAttempt[];
  bestScore: number;
  latestScore: number;
  quizPassed: boolean;
  quizPassedAt: Timestamp | null;
  attemptsUsed: number;
  practicalSignOff: PracticalSignOff | null;
  certificateId: string | null;
  certifiedAt: Timestamp | null;
  certificateExpiryDate: Timestamp | null;
  startedAt: Timestamp | null;
  completedAt: Timestamp | null;
  lastActivityAt: Timestamp | null;
  // Optional: absent on legacy/machine assignments.
  category?: TrainingModuleCategory;
  offboardDetails?: OffboardTrainingDetails | null;
  offboardCompletion?: OffboardCompletion | null;
  /** Training Type picker value (Task 5) — defaults from the module's trainingType. */
  trainingType?: TraineeTrainingType;
  /** Training Period picker value in months (Task 5) — defaults to 6, same preset model as Trainee Programme. */
  trainingPeriodMonths?: number;
}

// ---------------------------------------------------------------------------
// Training Certificate
// ---------------------------------------------------------------------------

export interface TrainingCertificate {
  id: string;
  certificateNumber: string;
  companyId: string;
  companyName: string;
  traineeId: string;
  traineeName: string;
  traineeNic: string;
  traineeDesignation: string;
  moduleId: string;
  moduleName: string;
  moduleCategory?: ModuleCategory;
  machineId: string;
  machineName: string;
  machineType: string;
  providerName?: string;
  issuedBy: string;
  issuedByName: string;
  issuedAt: Timestamp;
  expiryDate: Timestamp | null;
  isExpired: boolean;
  quizScore: number;
  practicalObservations: string;
  pdfUrl: string;
  assignmentId: string;
  isRevoked: boolean;
  revokedAt: Timestamp | null;
  revokedBy: string | null;
  revokedReason: string | null;
}

// ---------------------------------------------------------------------------
// Content Library
// ---------------------------------------------------------------------------

export interface ContentLibraryItem {
  id: string;
  companyId: string;
  name: string;
  type: ContentLibraryItemType;
  url: string;
  thumbnailUrl: string;
  fileSizeBytes: number;
  durationSeconds: number;
  pageCount: number;
  mimeType: string;
  tags: string[];
  uploadedBy: string;
  uploadedAt: Timestamp;
  usedInModules: string[];
}

// ---------------------------------------------------------------------------
// Quiz Session State (client-side only, not persisted to Firestore)
// ---------------------------------------------------------------------------

export interface QuizAttemptResult {
  score: number;
  passed: boolean;
  totalQuestions: number;
  correctAnswers: number;
  timeTakenSeconds: number;
  answers: QuizAnswer[];
}

export interface QuizSessionState {
  assignmentId: string;
  moduleId: string;
  attemptNumber: number;
  startedAt: Date;
  timeRemaining: number | null;
  questions: QuizQuestion[];
  currentIndex: number;
  answers: Record<string, string[]>;
  isSubmitted: boolean;
  results: QuizAttemptResult | null;
}
