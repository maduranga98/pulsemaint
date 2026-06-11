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

export type DocumentFileType = 'cad' | 'document' | 'image' | 'video' | 'compressed' | 'sop_link';

export type PartSource = 'stock' | 'external';

export type EstimatedDurationUnit = 'minutes' | 'hours' | 'days';

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
  hoursWorked: number;
  tasksDescription: string;
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
  isManualContractor: boolean;

  // Task Checklist
  checklist: ChecklistItem[];

  // Documents
  documents: WODocument[];

  // Parts
  partsRequests: PartsRequest[];

  // Completion
  actualStartTime: Timestamp | null;
  actualEndTime: Timestamp | null;
  totalDurationMinutes: number | null;
  workDoneDescription: string | null;
  rootCause: WORootCause | null;
  rootCauseDescription: string | null;
  partsUsed: PartUsed[];
  technicianWorkLogs: TechnicianWorkLog[];
  contractorHoursLog: ContractorHoursLog | null;
  postRepairChecklist: PostRepairChecklistItem[];
  testRunResult: TestRunResult | null;
  testRunNotes: string | null;
  finalPhotos: string[];
  machineStatusAfterRepair: MachineStatusAfterRepair | null;

  // Sign-Off
  supervisorSignOffSignature: string | null;
  supervisorSignOffBy: string | null;
  supervisorSignOffAt: Timestamp | null;
  supervisorSignOffNotes: string | null;

  // Status History
  statusHistory: WOStatusHistoryEntry[];

  // Metadata
  createdBy: string;
  createdByName: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  closedAt: Timestamp | null;
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
  priority: WOPriority;
  description: string;
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
  isManualContractor: boolean;

  checklist: Omit<ChecklistItem, 'isCompleted' | 'completedBy' | 'completedByName' | 'completedAt'>[];
  documents: File[];
  partsRequests: Omit<PartsRequest, 'id' | 'requestedBy' | 'requestedByName' | 'requestedAt' | 'status' | 'approvedBy' | 'approvedAt' | 'rejectedReason' | 'issuedBy' | 'issuedAt'>[];
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
  signature: string;
  notes: string;
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
