import type { Timestamp } from 'firebase/firestore';

// ---------------------------------------------------------------------------
// Role & Permission Types
// ---------------------------------------------------------------------------

export type UserRole =
  | 'floor_operator'
  | 'trainee'
  | 'technician'
  | 'store_keeper'
  | 'maintenance_supervisor'
  | 'plant_manager'
  | 'hr_officer'
  | 'admin';

// ---------------------------------------------------------------------------
// Breakdown Domain Types
// ---------------------------------------------------------------------------

export type BreakdownStatus =
  | 'reported'
  | 'acknowledged'
  | 'triage_in_progress'
  | 'assigned'
  | 'en_route'
  | 'repair_in_progress'
  | 'on_hold_parts'
  | 'on_hold_approval'
  | 'resolved'
  | 'closed'
  | 'cancelled';

export type BreakdownSeverity = 'critical' | 'high' | 'medium' | 'low';

export type BreakdownType =
  | 'mechanical'
  | 'electrical'
  | 'hydraulic'
  | 'pneumatic'
  | 'software'
  | 'other';

export type BreakdownSource =
  | 'qr_scan'
  | 'whatsapp'
  | 'web_browser'
  | 'technician_qr'
  | 'iot';

export type RootCause =
  | 'wear_and_tear'
  | 'operator_error'
  | 'manufacturing_defect'
  | 'lack_of_maintenance'
  | 'external_damage'
  | 'unknown';

// ---------------------------------------------------------------------------
// Core Breakdown Interface
// ---------------------------------------------------------------------------

export interface StatusHistoryEntry {
  status: BreakdownStatus;
  changedBy: string;
  changedByName: string;
  changedAt: Timestamp;
  note: string | null;
}

export interface Breakdown {
  // Identity
  id: string;
  ticketNumber: string;
  siteId: string;

  // Machine snapshot at time of report
  machineId: string;
  machineName: string;
  machineLocation: string;
  machineDepartment: string;
  machineCriticality: 1 | 2 | 3 | 4 | 5;

  // Report details
  severity: BreakdownSeverity;
  type: BreakdownType;
  description: string;
  photos: string[];
  video: string | null;
  machineStillRunning: boolean;
  productionImpact: string;
  attemptedFixes: string;
  source: BreakdownSource;

  // Reporter
  reportedBy: string;
  reporterName: string;
  reporterRole: UserRole;
  reportedAt: Timestamp;

  // Lifecycle
  status: BreakdownStatus;
  statusHistory: StatusHistoryEntry[];

  // Assignment
  assignedTechnicianIds: string[];
  assignedTechnicianNames: string[];
  assignedContractorId: string | null;

  // State timestamps
  acknowledgedAt: Timestamp | null;
  acknowledgedBy: string | null;
  assignedAt: Timestamp | null;
  enRouteAt: Timestamp | null;
  repairStartedAt: Timestamp | null;
  resolvedAt: Timestamp | null;
  closedAt: Timestamp | null;

  // Cancellation
  cancelReason: string | null;
  cancelReasonCategory: string | null;
  cancelledBy: string | null;
  cancelledByName: string | null;
  cancelledAt: Timestamp | null;

  // SLA
  slaDeadline: Timestamp | null;
  slaBreached: boolean;

  // Resolution
  rootCause: RootCause | null;
  rootCauseDescription: string | null;
  correctiveActions: string | null;
  preventiveRecommendations: string | null;
  resolutionPhotos: string[];

  // Links
  linkedWOId: string | null;
  linkedTriageSessionId: string | null;

  // Flags
  isRecurringFlag: boolean;
  productionHoursLost: number | null;

  // Metadata
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ---------------------------------------------------------------------------
// Form payload (no auto-generated / server-set fields)
// ---------------------------------------------------------------------------

export interface CreateBreakdownPayload {
  siteId: string;
  machineId: string;
  machineName: string;
  machineLocation: string;
  machineDepartment: string;
  machineCriticality: 1 | 2 | 3 | 4 | 5;
  severity: BreakdownSeverity;
  type: BreakdownType;
  description: string;
  photos: File[];
  video: File | null;
  machineStillRunning: boolean;
  productionImpact: string;
  attemptedFixes: string;
  source: BreakdownSource;
}

export interface UpdateStatusPayload {
  breakdownId: string;
  newStatus: BreakdownStatus;
  note?: string;
}

export interface RootCausePayload {
  rootCause: RootCause;
  rootCauseDescription: string;
  correctiveActions: string;
  preventiveRecommendations: string;
  resolutionPhotos: File[];
}

// ---------------------------------------------------------------------------
// Counter document (ticket number sequencing)
// ---------------------------------------------------------------------------

export interface BreakdownCounter {
  siteId: string;
  year: number;
  lastSequence: number;
}

// ---------------------------------------------------------------------------
// Notification log
// ---------------------------------------------------------------------------

export type NotificationType = 'push' | 'sms' | 'email' | 'in_app';
export type NotificationStatus = 'sent' | 'failed' | 'pending';

export interface NotificationLog {
  id: string;
  breakdownId: string;
  ticketNumber: string;
  type: NotificationType;
  trigger: string;
  recipientUserId: string;
  recipientName: string;
  channel: string;
  sentAt: Timestamp;
  status: NotificationStatus;
  errorMessage: string | null;
}

// ---------------------------------------------------------------------------
// Dashboard aggregation
// ---------------------------------------------------------------------------

export interface BreakdownStats {
  totalActive: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  resolvedToday: number;
  avgMttrTodayMs: number;
  productionHoursLostShift: number;
  overdueCount: number;
}

// ---------------------------------------------------------------------------
// Kanban column shape
// ---------------------------------------------------------------------------

export interface KanbanColumn {
  status: BreakdownStatus;
  label: string;
  breakdowns: Breakdown[];
}

// ---------------------------------------------------------------------------
// Machine (lightweight — full model lives in machines collection)
// ---------------------------------------------------------------------------

export interface MachineSummary {
  id: string;
  name: string;
  location: string;
  department: string;
  criticality: 1 | 2 | 3 | 4 | 5;
  activeBreakdownId: string | null;
  activeBreakdownSeverity: BreakdownSeverity | null;
}

// ---------------------------------------------------------------------------
// Technician tracker
// ---------------------------------------------------------------------------

export interface TechnicianStatus {
  userId: string;
  name: string;
  avatarUrl: string | null;
  currentBreakdownId: string | null;
  currentBreakdownTicket: string | null;
  currentStatus: BreakdownStatus | null;
  timeOnJobMs: number | null;
}

// ---------------------------------------------------------------------------
// WhatsApp bot parsed payload
// ---------------------------------------------------------------------------

export interface WhatsAppBreakdownMessage {
  senderId: string;
  senderPhone: string;
  rawText: string;
  parsedMachineId: string | null;
  parsedType: BreakdownType | null;
  parsedSeverity: BreakdownSeverity | null;
}

// ---------------------------------------------------------------------------
// QR scan result
// ---------------------------------------------------------------------------

export type QRScanAction = 'job_checkin' | 'report_breakdown' | 'repair_completion';

export interface QRScanResult {
  machineId: string;
  action: QRScanAction;
  linkedWOId: string | null;
}

// ---------------------------------------------------------------------------
// Filter / query state
// ---------------------------------------------------------------------------

export interface BreakdownFilters {
  status: BreakdownStatus | 'all';
  severity: BreakdownSeverity | 'all';
  type: BreakdownType | 'all';
  technicianId: string | null;
  reporterId: string | null;
  dateFrom: Date | null;
  dateTo: Date | null;
  isRecurring: boolean | null;
  searchQuery: string;
}
