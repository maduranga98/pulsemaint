export type WatchLevel = 'critical_watch' | 'monitor' | 'info_only';
export type CarryForwardStatus = 'continue' | 'escalate' | 'on_hold';
export type NextShiftPriority = 'urgent' | 'continue' | 'monitor';
export type HandoverStatus = 'pending_acceptance' | 'accepted' | 'archived';
export type WatchFlagStatus = 'active' | 'resolved' | 'carried_forward';
export type ShiftStatus = 'active' | 'inactive';
export type ShiftDay = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';

export interface ShiftConfig {
  id: string;
  companyId: string;
  shiftName: string;
  startTime: string;
  endTime: string;
  color: string;
  activeDays: ShiftDay[];
  department: string | null;
  status: ShiftStatus;
  memberIds: string[];
  memberNames: string[];
  /** Roles scheduled for this shift plan. Any user with one of these roles is part of the plan. */
  roles: string[];
  createdAt?: Date;
  updatedAt?: Date;
}

export type ShiftSessionStatus = 'active' | 'completed';

/** A persisted record of one person actually working one shift (start → end). */
export interface ShiftSession {
  id: string;
  companyId: string;
  userId: string;
  userName: string;
  userRole: string;
  shiftConfigId: string;
  shiftName: string;
  shiftDate: string;
  scheduledStart: string;
  scheduledEnd: string;
  scheduledMinutes: number;
  actualStart: Date;
  actualEnd: Date | null;
  totalMinutes: number | null;
  otMinutes: number | null;
  status: ShiftSessionStatus;
  handoverId: string | null;
}

export interface WatchFlag {
  id: string;
  machineId: string;
  machineName: string;
  machineLocation: string;
  watchLevel: WatchLevel;
  reason: string;
  recommendedAction: string;
  linkedBreakdownId: string | null;
  /** Ticket number/type of the linked breakdown, captured at flag-creation time so exports can show a readable reference without a live lookup. */
  linkedBreakdownTicketNumber: string | null;
  linkedBreakdownType: string | null;
  status: WatchFlagStatus;
  resolvedAt: Date | null;
  resolvedBy: string | null;
  carriedFromHandoverId: string | null;
}

export interface PendingWOSnapshot {
  woId: string;
  woNumber: string;
  machineName: string;
  woType: string;
  priority: string;
  currentStatus: string;
  assignedTechnician: string;
  dueDate: Date | null;
  supervisorNote: string;
  carryForwardStatus: CarryForwardStatus;
}

export interface OngoingBreakdownSnapshot {
  ticketId: string;
  ticketNumber: string;
  machineName: string;
  severity: string;
  currentState: string;
  timeElapsedMinutes: number;
  assignedTechnician: string;
  supervisorNote: string;
  nextShiftPriority: NextShiftPriority;
}

export interface ShiftStatsAuto {
  breakdownsOpened: number;
  breakdownsClosed: number;
  breakdownsCarriedOver: number;
  criticalBreakdowns: number;
  highBreakdowns: number;
  wosOpened: number;
  wosCompleted: number;
  wosPending: number;
  pmsCompleted: number;
  pmsMissed: number;
  partsIssued: number;
  partsIssuedValue: number;
  productionHoursLost: number;
}

export interface LowStockAlert {
  partId: string;
  partName: string;
  currentQty: number;
  minQty: number;
}

export interface ShiftHandover {
  id: string;
  companyId: string;
  shiftConfigId: string;
  shiftName: string;
  shiftDate: string;
  outgoingSupervisorId: string;
  outgoingSupervisorName: string;
  outgoingSupervisorDesignation: string | null;
  shiftActualStart: Date;
  /** SUP-020: actual clock-out time for the shift this handover closes out. */
  shiftActualEnd: Date | null;
  /** The assigned shift plan's scheduled start/end time (HH:MM), e.g. "08:00" / "16:00". */
  scheduledStart: string | null;
  scheduledEnd: string | null;
  /** SUP-020: scheduled shift length, actual worked minutes, and OT (worked - scheduled, floored at 0). */
  scheduledMinutes: number | null;
  totalMinutes: number | null;
  otMinutes: number | null;
  handoverSubmittedAt: Date;
  incomingSupervisorId: string | null;
  incomingSupervisorName: string | null;
  incomingSupervisorDesignation: string | null;
  handoverAcceptedAt: Date | null;
  /** Minutes the supervisor clocked in late against their assigned shift's scheduled start (0 if on time or early). */
  overlapMinutes: number | null;
  stats: ShiftStatsAuto;
  watchFlags: WatchFlag[];
  pendingWOs: PendingWOSnapshot[];
  ongoingBreakdowns: OngoingBreakdownSnapshot[];
  partsNotes: string;
  lowStockAlerts: LowStockAlert[];
  safetyIncidentOccurred: boolean;
  safetyIncidentDescription: string | null;
  restrictedAreas: string | null;
  temporaryRepairs: string | null;
  generalNotes: string;
  outgoingAcknowledged: boolean;
  incomingAcknowledged: boolean;
  status: HandoverStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface DraftWatchFlag {
  machineId: string;
  machineName: string;
  machineLocation: string;
  watchLevel: WatchLevel;
  reason: string;
  recommendedAction: string;
  linkedBreakdownId: string | null;
  linkedBreakdownTicketNumber: string | null;
  linkedBreakdownType: string | null;
}

export interface DraftHandover {
  shiftConfigId: string;
  shiftName: string;
  shiftActualStart: Date;
  /** SUP-020: populated from the just-completed shift session so OT can be stored on the handover. */
  shiftActualEnd: Date | null;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  scheduledMinutes: number | null;
  totalMinutes: number | null;
  otMinutes: number | null;
  watchFlags: DraftWatchFlag[];
  pendingWOs: PendingWOSnapshot[];
  ongoingBreakdowns: OngoingBreakdownSnapshot[];
  partsNotes: string;
  lowStockAlerts: LowStockAlert[];
  safetyIncidentOccurred: boolean;
  safetyIncidentDescription: string;
  restrictedAreas: string;
  temporaryRepairs: string;
  generalNotes: string;
  outgoingAcknowledged: boolean;
}

export interface HandoverHistoryFilters {
  dateFrom: string | null;
  dateTo: string | null;
  /** Free-text search across any row's person name. */
  personName: string;
  /** Exact role match ('' = all roles). */
  role: string;
  /** Exact shift-plan name match, picked from a select ('' = all shifts). */
  shiftName: string;
  /** Exact department match, picked from a select ('' = all departments). */
  department: string;
  /** Only show rows where the person started their shift late. */
  lateOnly: boolean;
}

export interface CompiledShiftSummary {
  stats: ShiftStatsAuto;
  pendingWOs: PendingWOSnapshot[];
  ongoingBreakdowns: OngoingBreakdownSnapshot[];
  lowStockAlerts: LowStockAlert[];
  shiftStartTime: Date;
  compiledAt: Date;
}

export interface HandoverStore {
  currentShift: ShiftConfig | null;
  shiftStartTime: Date | null;
  isShiftActive: boolean;
  activeSession: ShiftSession | null;
  lastCompletedSession: ShiftSession | null;
  isShiftStateLoaded: boolean;
  pendingHandover: ShiftHandover | null;
  hasPendingHandover: boolean;
  draftHandover: DraftHandover | null;
  compiledStats: ShiftStatsAuto | null;
  isCompilingStats: boolean;
  handoverHistory: ShiftHandover[];
  historyFilters: HandoverHistoryFilters;
  /** Restore any persisted active shift session (survives refresh / re-login). */
  initShiftState: () => Promise<void>;
  startShift: (shiftConfigId?: string) => Promise<void>;
  endShift: () => Promise<ShiftSession | null>;
  compileShiftSummary: () => Promise<ShiftStatsAuto>;
  updateDraftHandover: (updates: Partial<DraftHandover>) => void;
  submitHandover: () => Promise<string>;
  acceptHandover: (handoverId: string) => Promise<void>;
  fetchPendingHandover: () => Promise<void>;
  fetchHandoverHistory: (filters: HandoverHistoryFilters) => Promise<void>;
  resolveWatchFlag: (handoverId: string, flagId: string) => Promise<void>;
}
