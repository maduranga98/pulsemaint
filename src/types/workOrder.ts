import type { Timestamp } from 'firebase/firestore';

// ---------------------------------------------------------------------------
// Enums / Union Types
// ---------------------------------------------------------------------------

export type WOType =
  | 'BREAKDOWN'
  | 'CORRECTIVE'
  | 'PREVENTIVE'
  | 'INSTALLATION'
  | 'MODIFICATION'
  | 'INSPECTION'
  | 'CONTRACTOR'
  | 'OTHER';

export type WOPriority = 'critical' | 'high' | 'medium' | 'low';

export type WOStatus =
  | 'DRAFT'
  | 'OPEN'
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'ON_HOLD_PARTS'
  | 'ON_HOLD_APPROVAL'
  | 'COMPLETED'
  | 'SIGNED_OFF'
  | 'CLOSED'
  | 'CANCELLED';

export type WORootCause =
  | 'wear_and_tear'
  | 'operator_error'
  | 'manufacturing_defect'
  | 'lack_of_maintenance'
  | 'external_damage'
  | 'unknown';

export type PartsRequestStatus = 'pending' | 'approved' | 'rejected' | 'issued' | 'returned';

export type TestRunResult = 'pass' | 'fail' | 'partial';

export type MachineStatusAfterRepair = 'operational' | 'partially_operational' | 'still_down';

// Outcome recorded by the supervisor/manager when signing off a work order.
export type WOSignOffOutcome = 'complete' | 'not_complete' | 'failed';

export type DocumentFileType = 'cad' | 'document' | 'image' | 'video' | 'compressed' | 'sop_link';

export type PartSource = 'stock' | 'external';

export type EstimatedDurationUnit = 'minutes' | 'hours' | 'days';

export type TimeSegmentState = 'travel' | 'waiting-parts' | 'waiting-permit' | 'working';

export interface TimeSegment {
  state: TimeSegmentState;
  startAt: Timestamp;
  endAt: Timestamp | null;
  note: string | null;
}

// ---------------------------------------------------------------------------
// Sub-Interfaces
// ---------------------------------------------------------------------------

export interface ChecklistItem {
  stepNumber: number;
  stepDescription: string;
  assignedTechnicianId: string | null;
  assignedTechnicianName: string | null;
  assignedTechnicianIds: string[];
  assignedTechnicianNames: string[];
  estimatedMinutes: number | null;
  estimatedDurationUnit: 'minutes' | 'hours' | 'days';
  isCompleted: boolean;
  completedBy: string | null;
  completedByName: string | null;
  completedAt: Timestamp | null;
  // Measurement fields
  inputType: 'checkbox' | 'measurement';
  method: string | null;
  unit: string | null;
  acceptableMin: number | null;
  acceptableMax: number | null;
  actualValue: number | null;
  result: 'pass' | 'fail' | null;
  repairNote: string | null;
  // Free-text note added by the person completing the task.
  completionNote?: string | null;
}

export interface WODocument {
  id: string;
  name: string;
  fileType: DocumentFileType;
  format: string;
  url: string;
  storagePath: string;
  fileSize: number;
  uploadedBy: string;
  uploadedByName: string;
  uploadedAt: Timestamp;
  isCompletionDocument: boolean;
}

export interface PartsRequest {
  id: string;
  partId: string;
  partName: string;
  partNumber: string;
  quantity: number;
  unit: string;
  currentStock: number;
  requestedBy: string;
  requestedByName: string;
  requestedAt: Timestamp;
  status: PartsRequestStatus;
  approvedBy: string | null;
  approvedAt: Timestamp | null;
  rejectedReason: string | null;
  issuedBy: string | null;
  issuedAt: Timestamp | null;
  note: string | null;
}

export interface PartUsed {
  partId: string | null;
  partName: string;
  quantity: number;
  unit: string;
  source: PartSource;
  unitCost: number;
  totalCost: number;
  warrantyMonths: number | null;
}

export interface TechnicianWorkLog {
  technicianId: string;
  technicianName: string;
  /** The person's role/designation, so a team WO shows who did what. */
  technicianRole?: string;
  hoursWorked: number;
  tasksDescription: string;
}

/**
 * One assigned person's own completion of their part of a team work order.
 * A WO is only finalised (moved to COMPLETED / sign-off) once every assigned
 * technician has recorded their own completion here. Each entry holds only the
 * work that person did — never anyone else's.
 */
/** The per-assignee working status on a shared work order. */
export type AssigneeWorkStatus = 'IN_PROGRESS' | 'ON_HOLD_PARTS' | 'ON_HOLD_APPROVAL';

/**
 * One assigned technician's own working state on a work order shared by several
 * people. Each person starts / holds / resumes independently: one starting
 * doesn't start the job for everyone, and one holding for parts doesn't pause
 * a teammate. The shared `status` is an aggregate for the supervisor's view.
 */
export interface AssigneeWorkState {
  technicianId: string;
  technicianName: string;
  status: AssigneeWorkStatus;
  /** When this person first started their own work. */
  startedAt: Timestamp | null;
  /** Reason shown while this person is on hold. */
  holdReason?: string;
  updatedAt: Timestamp | null;
}

export interface AssigneeCompletion {
  technicianId: string;
  technicianName: string;
  technicianRole?: string;
  /** Their own free-text description of what they did. */
  workDoneDescription: string;
  /** Auto-compiled from the checklist steps they personally ticked off. */
  completedStepsDescription: string;
  hoursWorked: number;
  completedAt: Timestamp | null;
}

export interface ContractorHoursLog {
  hoursOnSite: number;
  hoursBilled: number;
  technicianNames: string[];
  notes: string;
}

export interface PostRepairChecklistItem {
  stepDescription: string;
  isCompleted: boolean;
  completedBy: string | null;
  completedAt: Timestamp | null;
  result: 'pass' | 'fail' | null;
  notes: string | null;
}

export interface WOStatusHistoryEntry {
  status: WOStatus;
  changedBy: string;
  changedByName: string;
  changedAt: Timestamp;
  note: string | null;
}

// ---------------------------------------------------------------------------
// Main WorkOrder Interface
// ---------------------------------------------------------------------------

export interface WorkOrder {
  // Identity
  id: string;
  woNumber: string;
  siteId: string;

  // Basic Info
  woType: WOType;
  priority: WOPriority;
  status: WOStatus;
  description: string;
  ptwCategory: string | null;
  // Safety Work Permit (Permit-to-Work) gate — when `requiresWorkPermit` is
  // set, the WO can't be started until its linked `work_permits` doc is active.
  requiresWorkPermit?: boolean;
  workPermitId?: string | null;
  specialToolsRequired: string;
  dueDate: Timestamp;
  slaDeadline: Timestamp;
  slaBreached: boolean;
  scheduledStart: Timestamp | null;
  estimatedDuration: number;
  estimatedDurationUnit: EstimatedDurationUnit;

  // Machine (snapshot at creation)
  machineId: string;
  machineName: string;
  machineDepartment: string;
  machineLocation: string;
  machineType: string;
  machineCriticality: 1 | 2 | 3 | 4 | 5;

  // Links
  linkedBreakdownId: string | null;
  linkedBreakdownTicketNumber: string | null;

  // Assignment
  supervisorInChargeId: string;
  supervisorInChargeName: string;

  // Internal Team
  assignedTechnicianIds: string[];
  assignedTechnicianNames: string[];

  // Contractor
  contractorCompanyId: string | null;
  contractorCompanyName: string | null;
  contractorContactPerson: string | null;
  contractorContactNumber: string | null;
  contractorTechnicianNames: string[];
  contractorTechnicianIds: string[];
  isManualContractor: boolean;

  // Task Checklist
  checklist: ChecklistItem[];

  // Documents
  documents: WODocument[];

  // Parts
  partsRequests: PartsRequest[];

  // QR check-in — arrival at the machine recorded by scanning its QR code
  checkedInAt?: Timestamp | null;
  checkedInBy?: string | null;
  checkedInByName?: string | null;

  // Completion
  actualStartTime: Timestamp | null;
  actualEndTime: Timestamp | null;
  totalDurationMinutes: number | null;
  workDoneDescription: string | null;
  rootCause: WORootCause | null;
  rootCauseDescription: string | null;
  partsUsed: PartUsed[];
  technicianWorkLogs: TechnicianWorkLog[];
  // Per-assignee self-completions — each assigned person records their own
  // work here before the WO can be finalised. Absent on older/solo WOs.
  assigneeCompletions?: AssigneeCompletion[];
  /** Per-assignee start/hold/resume state on a team WO (see AssigneeWorkState). */
  assigneeStates?: AssigneeWorkState[];
  contractorHoursLog: ContractorHoursLog | null;
  // Contractor sign-off figures: parts used cost is recomputed from
  // partsUsed, projectCost is the contractor's own cost, and the total is
  // their sum. Kept as three fields so the contractor's job history can show
  // the breakdown rather than only the combined figure.
  totalPartsCost?: number;
  projectCost?: number;
  totalProjectCost?: number;
  contractorRating?: WOContractorRating | null;
  postRepairChecklist: PostRepairChecklistItem[];
  testRunResult: TestRunResult | null;
  testRunNotes: string | null;
  finalPhotos: string[];
  machineStatusAfterRepair: MachineStatusAfterRepair | null;

  // Sign-Off — the system automatically records who signed off (no manual
  // signature is captured). `signOffOutcome` is the closing disposition; a
  // reason is required when it is not a clean completion.
  supervisorSignOffSignature: string | null;
  supervisorSignOffBy: string | null;
  supervisorSignOffByName: string | null;
  supervisorSignOffAt: Timestamp | null;
  supervisorSignOffNotes: string | null;
  signOffOutcome: WOSignOffOutcome | null;
  signOffOutcomeReason: string | null;

  // Status History
  statusHistory: WOStatusHistoryEntry[];

  // Time Tracking
  timeSegments: TimeSegment[];

  // Metadata
  createdBy: string;
  createdByName: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  closedAt: Timestamp | null;
  closedBy: string | null;
  closedByName: string | null;
  cancelledAt: Timestamp | null;
  cancelReason: string | null;
}

// ---------------------------------------------------------------------------
// Counter document for WO number generation
// ---------------------------------------------------------------------------

export interface WOCounter {
  siteId: string;
  year: number;
  lastSequence: number;
}

// ---------------------------------------------------------------------------
// Machine History Entry
// ---------------------------------------------------------------------------

export interface MachineHistoryEntry {
  id: string;
  woNumber: string;
  woType: WOType;
  priority: WOPriority;
  date: Timestamp;
  actualStartTime: Timestamp;
  actualEndTime: Timestamp;
  totalDurationMinutes: number;
  rootCause: WORootCause | null;
  workDoneDescription: string;
  internalTeamNames: string[];
  contractorName: string | null;
  contractorTechnicianNames: string[];
  contractorTechnicianIds: string[];
  partsUsed: PartUsed[];
  totalPartsCost: number;
  testRunResult: string;
  finalPhotoUrls: string[];
  supervisorSignOffBy: string;
  supervisorSignOffAt: Timestamp;
  linkedBreakdownId: string | null;
}

// ---------------------------------------------------------------------------
// Form Payload Types (for create/update operations)
// ---------------------------------------------------------------------------

export interface CreateWOPayload {
  woType: WOType;
  // Only meaningful when woType === 'PREVENTIVE' — sets the PM schedule's
  // pmType so PM Schedules/Calendar/Compliance show the real category.
  pmType?: import('./pm.types').PMType;
  priority: WOPriority;
  description: string;
  specialToolsRequired?: string;
  dueDate: Date;
  scheduledStart: Date | null;
  estimatedDuration: number;
  estimatedDurationUnit: EstimatedDurationUnit;
  linkedBreakdownId: string | null;
  linkedBreakdownTicketNumber: string | null;

  machineId: string;
  machineName: string;
  machineDepartment: string;
  machineLocation: string;
  machineType: string;
  machineCriticality: 1 | 2 | 3 | 4 | 5;

  supervisorInChargeId: string;
  supervisorInChargeName: string;
  assignedTechnicianIds: string[];
  assignedTechnicianNames: string[];

  contractorCompanyId: string | null;
  contractorCompanyName: string | null;
  contractorContactPerson: string | null;
  contractorContactNumber: string | null;
  contractorTechnicianNames: string[];
  contractorTechnicianIds: string[];
  isManualContractor: boolean;

  checklist: Omit<ChecklistItem, 'isCompleted' | 'completedBy' | 'completedByName' | 'completedAt'>[];
  documents: File[];
  partsRequests: Omit<PartsRequest, 'id' | 'requestedBy' | 'requestedByName' | 'requestedAt' | 'status' | 'approvedBy' | 'approvedAt' | 'rejectedReason' | 'issuedBy' | 'issuedAt'>[];

  // Optional Work Permit raised together with the WO. When present, the WO is
  // flagged `requiresWorkPermit` and can't start until the permit is active.
  workPermit?: CreateWOWorkPermit | null;
}

/** Minimal Work Permit captured inline on the WO creation form. */
export interface CreateWOWorkPermit {
  category: import('./safety').WorkPermitCategory;
  title: string;
  validFrom: string;
  validTo: string;
  hazards: string;
  ppeRequired: string;
  precautions: string[];
}

export interface WOCompletionPayload {
  actualStartTime: Date;
  actualEndTime: Date;
  workDoneDescription: string;
  rootCause: WORootCause;
  rootCauseDescription: string;
  partsUsed: PartUsed[];
  technicianWorkLogs: TechnicianWorkLog[];
  contractorHoursLog: ContractorHoursLog | null;
  postRepairChecklist: PostRepairChecklistItem[];
  testRunResult: TestRunResult;
  testRunNotes: string;
  finalPhotos: File[];
  machineStatusAfterRepair: MachineStatusAfterRepair;
  updatedCADFiles: File[];
  warrantyDocuments: File[];
}

export interface WOSignOffPayload {
  outcome: WOSignOffOutcome;
  // Required when outcome is 'not_complete' or 'failed'; optional otherwise.
  outcomeReason: string | null;
  notes: string;
  /** Contractor work orders only — the contractor's own labour/service cost,
   *  entered at sign-off. Total cost = parts used + this. */
  projectCost?: number | null;
  /** Contractor work orders only — how the contractor performed on this job. */
  contractorRating?: WOContractorRating | null;
}

/** Per-job contractor rating captured at work order sign-off. Mirrors the
 *  four-dimension model used by the contractor jobs area. */
export interface WOContractorRating {
  speedScore: number;
  qualityScore: number;
  professionalismScore: number;
  communicationScore: number;
  overallScore: number;
  ratedBy: string;
  ratedByName: string;
  ratedAt: Timestamp | null;
}

// ---------------------------------------------------------------------------
// UI / Aggregation Types
// ---------------------------------------------------------------------------

export interface WOStats {
  openCount: number;
  overdueCount: number;
  avgCompletionTimeMinutes: number;
  completedThisWeek: number;
  byType: Record<WOType, number>;
  byStatus: Record<WOStatus, number>;
}

export interface WOFilters {
  status?: WOStatus[];
  woType?: WOType[];
  priority?: WOPriority[];
  machineId?: string;
  technicianId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  searchQuery?: string;
}

export interface KanbanWOColumn {
  status: WOStatus;
  label: string;
  workOrders: WorkOrder[];
  count: number;
}
