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
  timeLimit: number;
  maxAttempts: number;
  passingScore: number;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  questions: QuizQuestion[];
}

// ---------------------------------------------------------------------------
// Training Module
// ---------------------------------------------------------------------------

export interface TrainingModule {
  id: string;
  companyId: string;
  title: string;
  description: string;
  machineId: string | null;
  machineTypeId: string | null;
  machineName: string;
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
  quiz: TrainingQuiz | null;
  tags: string[];
  prerequisiteModuleIds: string[];
  usageCount: number;
  completionCount: number;
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
// Training Assignment
// ---------------------------------------------------------------------------

export interface TrainingAssignment {
  id: string;
  companyId: string;
  moduleId: string;
  moduleName: string;
  machineId: string;
  machineName: string;
  traineeId: string;
  traineeName: string;
  traineeEmail: string;
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
  machineId: string;
  machineName: string;
  machineType: string;
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
