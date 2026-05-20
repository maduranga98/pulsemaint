import type { Timestamp } from 'firebase/firestore';

// ---------------------------------------------------------------------------
// Enums / Union Types
// ---------------------------------------------------------------------------

export type PMType =
  | 'lubrication'
  | 'inspection'
  | 'calibration'
  | 'filter_replacement'
  | 'belt_chain_check'
  | 'full_service'
  | 'electrical_check'
  | 'hydraulic_service'
  | 'safety_inspection'
  | 'other';

export type RecurrenceType =
  | 'daily'
  | 'weekly'
  | 'biweekly'
  | 'monthly'
  | 'quarterly'
  | 'semi_annual'
  | 'annual'
  | 'custom';

export type PMStatus = 'active' | 'paused' | 'completed' | 'archived';

export type PMHistoryStatus =
  | 'completed_on_time'
  | 'completed_late'
  | 'overdue'
  | 'missed'
  | 'in_progress'

export type PMOperationalStatus = 'on_track' | 'due_soon' | 'overdue' | 'paused';

export type TriggerUnit = 'operating_hours' | 'production_cycles';

// ---------------------------------------------------------------------------
// Sub-Interfaces
// ---------------------------------------------------------------------------

export interface PMChecklistItem {
  id: string;
  step: number;
  description: string;
  estimatedMinutes: number;
  photoRequired: boolean;
}

export interface PMPreallocatedPart {
  partId: string;
  partName: string;
  partNumber: string;
  quantity: number;
}

export interface PMDocument {
  name: string;
  url: string;
  type: string;
  size: number;
}

// ---------------------------------------------------------------------------
// Main PM Schedule Interface
// ---------------------------------------------------------------------------

export interface PMSchedule {
  id: string;
  companyId: string;
  name: string;
  pmType: PMType;
  priority: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  machineId: string;
  machineName: string;
  machineCriticality: number;
  department: string;
  location: string;
  triggerType: 'calendar' | 'usage';

  // Calendar trigger fields
  firstDueDate: Timestamp;
  recurrenceType: RecurrenceType;
  customIntervalDays: number | null;
  nextDueDate: Timestamp;
  endDate: Timestamp | null;
  noEndDate: boolean;

  // Seasonal override
  seasonalOverride: boolean;
  peakSeasonStart: Timestamp | null;
  peakSeasonEnd: Timestamp | null;
  peakSeasonInterval: string | null;

  // Usage trigger fields
  triggerAfterValue: number | null;
  triggerUnit: TriggerUnit | null;
  currentMeterValue: number | null;
  lastMeterResetDate: Timestamp | null;
  lastMeterUpdateDate: Timestamp | null;

  // Team
  assignedTechnicianIds: string[];
  assignedTechnicianNames: string[];
  estimatedDuration: number;
  estimatedDurationUnit: 'hours' | 'days';
  skillsRequired: string[];

  // Checklist
  checklistItems: PMChecklistItem[];
  checklistTemplateId: string | null;

  // Pre-allocated parts
  preallocatedParts: PMPreallocatedPart[];

  // Attached documents
  documents: PMDocument[];

  // Alert settings
  leadTimeDays: number;
  overdueEscalationHours: number;
  autoCloseAfterDays: number;

  // Status
  status: PMStatus;

  // Compliance
  totalScheduled: number;
  completedOnTime: number;
  completedLate: number;
  missed: number;
  complianceRate: number;

  // Metadata
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  lastWoGeneratedAt: Timestamp | null;
  lastWoId: string | null;
}

// ---------------------------------------------------------------------------
// PM History Interface
// ---------------------------------------------------------------------------

export interface PMHistory {
  id: string;
  companyId: string;
  scheduleId: string;
  scheduleName: string;
  machineId: string;
  machineName: string;
  woId: string;
  woNumber: string;
  dueDate: Timestamp;
  completedDate: Timestamp | null;
  status: PMHistoryStatus;
  daysOverdue: number;
  technicianIds: string[];
  technicianNames: string[];
  duration: number | null;
  month: string;
  year: number;
  createdAt: Timestamp;
}

// ---------------------------------------------------------------------------
// Form Payload Types
// ---------------------------------------------------------------------------

export interface CreatePMPayload {
  name: string;
  pmType: PMType;
  priority: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  machineId: string;
  machineName: string;
  machineCriticality: number;
  department: string;
  location: string;
  triggerType: 'calendar' | 'usage';

  firstDueDate: Date;
  recurrenceType: RecurrenceType;
  customIntervalDays: number | null;
  endDate: Date | null;
  noEndDate: boolean;

  seasonalOverride: boolean;
  peakSeasonStart: Date | null;
  peakSeasonEnd: Date | null;
  peakSeasonInterval: string | null;

  triggerAfterValue: number | null;
  triggerUnit: TriggerUnit | null;
  currentMeterValue: number | null;
  lastMeterResetDate: Date | null;

  assignedTechnicianIds: string[];
  assignedTechnicianNames: string[];
  estimatedDuration: number;
  estimatedDurationUnit: 'hours' | 'days';
  skillsRequired: string[];

  checklistItems: Omit<PMChecklistItem, 'id'>[];
  checklistTemplateId: string | null;

  preallocatedParts: Omit<PMPreallocatedPart, 'partName' | 'partNumber'>[];
  documents: File[];

  leadTimeDays: number;
  overdueEscalationHours: number;
  autoCloseAfterDays: number;
}

export interface UpdatePMPayload {
  scheduleId: string;
  companyId: string;
  name?: string;
  pmType?: PMType;
  priority?: 'critical' | 'high' | 'medium' | 'low';
  description?: string;
  machineId?: string;
  machineName?: string;
  machineCriticality?: number;
  department?: string;
  location?: string;
  triggerType?: 'calendar' | 'usage';

  firstDueDate?: Date;
  recurrenceType?: RecurrenceType;
  customIntervalDays?: number | null;
  endDate?: Date | null;
  noEndDate?: boolean;

  seasonalOverride?: boolean;
  peakSeasonStart?: Date | null;
  peakSeasonEnd?: Date | null;
  peakSeasonInterval?: string | null;

  triggerAfterValue?: number | null;
  triggerUnit?: TriggerUnit | null;
  currentMeterValue?: number | null;
  lastMeterResetDate?: Date | null;

  assignedTechnicianIds?: string[];
  assignedTechnicianNames?: string[];
  estimatedDuration?: number;
  estimatedDurationUnit?: 'hours' | 'days';
  skillsRequired?: string[];

  checklistItems?: PMChecklistItem[];
  checklistTemplateId?: string | null;

  preallocatedParts?: PMPreallocatedPart[];
  documents?: File[];

  leadTimeDays?: number;
  overdueEscalationHours?: number;
  autoCloseAfterDays?: number;

  status?: PMStatus;
}

// ---------------------------------------------------------------------------
// Filters & Dashboard Types
// ---------------------------------------------------------------------------

export interface PMFilters {
  machineId?: string;
  pmType?: PMType[];
  technicianId?: string;
  status?: PMStatus[];
  dateFrom?: Date;
  dateTo?: Date;
  priority?: ('critical' | 'high' | 'medium' | 'low')[];
  searchQuery?: string;
}

export interface ComplianceStats {
  overallComplianceRate: number;
  totalScheduledThisMonth: number;
  completedOnTimeThisMonth: number;
  overdueCount: number;
  monthlyTrend: MonthlyComplianceTrend[];
  byMachine: MachineComplianceRecord[];
  byTechnician: TechnicianComplianceRecord[];
}

export interface MonthlyComplianceTrend {
  month: string;
  complianceRate: number;
  breakdownCount: number;
  scheduledCount: number;
  completedCount: number;
}

export interface MachineComplianceRecord {
  machineId: string;
  machineName: string;
  complianceRate: number;
  totalScheduled: number;
  completedOnTime: number;
  completedLate: number;
  missed: number;
}

export interface TechnicianComplianceRecord {
  technicianId: string;
  technicianName: string;
  complianceRate: number;
  totalAssigned: number;
  completedOnTime: number;
  completedLate: number;
  missed: number;
}

export interface CalendarEvent {
  id: string;
  scheduleId: string;
  title: string;
  date: Date;
  priority: 'critical' | 'high' | 'medium' | 'low';
  machineName: string;
  technicianNames: string[];
  pmType: PMType;
  status: PMStatus;
}

export interface TechnicianWorkload {
  technicianId: string;
  technicianName: string;
  assignedCount: number;
  totalEstimatedHours: number;
  schedules: {
    scheduleId: string;
    scheduleName: string;
    dueDate: Date;
    estimatedDuration: number;
    estimatedDurationUnit: 'hours' | 'days';
    machineName: string;
    priority: 'critical' | 'high' | 'medium' | 'low';
  }[];
}
