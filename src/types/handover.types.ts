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
  createdAt?: Date;
  updatedAt?: Date;
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
  handoverSubmittedAt: Date;
  incomingSupervisorId: string | null;
  incomingSupervisorName: string | null;
  incomingSupervisorDesignation: string | null;
  handoverAcceptedAt: Date | null;
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
}

export interface DraftHandover {
  shiftConfigId: string;
  shiftName: string;
  shiftActualStart: Date;
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
  supervisorName: string;
  shiftName: string;
  department: string;
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
  pendingHandover: ShiftHandover | null;
  hasPendingHandover: boolean;
  draftHandover: DraftHandover | null;
  compiledStats: ShiftStatsAuto | null;
  isCompilingStats: boolean;
  handoverHistory: ShiftHandover[];
  historyFilters: HandoverHistoryFilters;
  startShift: (shiftConfigId: string) => Promise<void>;
  endShift: () => Promise<void>;
  compileShiftSummary: () => Promise<ShiftStatsAuto>;
  updateDraftHandover: (updates: Partial<DraftHandover>) => void;
  submitHandover: () => Promise<string>;
  acceptHandover: (handoverId: string) => Promise<void>;
  fetchPendingHandover: () => Promise<void>;
  fetchHandoverHistory: (filters: HandoverHistoryFilters) => Promise<void>;
  resolveWatchFlag: (handoverId: string, flagId: string) => Promise<void>;
}
