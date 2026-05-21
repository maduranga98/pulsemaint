import type { Timestamp } from 'firebase/firestore';

// ---------------------------------------------------------------------------
// Enums / Union Types
// ---------------------------------------------------------------------------

export type ChartDateRange = '7D' | '30D' | '3M' | '6M' | '12M';

export type DashboardVariant = 'supervisor' | 'manager' | 'technician' | 'inventory' | 'training';

export type AnalyticsMachineStatus =
  | 'operational'
  | 'breakdown'
  | 'maintenance'
  | 'pm_in_progress'
  | 'decommissioned';

export type TechnicianCurrentStatus = 'available' | 'on_job' | 'on_break' | 'off_shift';

// ---------------------------------------------------------------------------
// KPI Card
// ---------------------------------------------------------------------------

export interface KpiCardData {
  label: string;
  value: number | string;
  unit?: string;
  trend?: number; // % change vs last period
  trendDirection?: 'up' | 'down' | 'neutral';
  trendPositive?: boolean; // is "up" good or bad for this metric?
  color: 'green' | 'amber' | 'red' | 'cyan' | 'blue';
  sparklineData?: number[]; // last 7 data points for sparkline
}

// ---------------------------------------------------------------------------
// Breakdown Kanban
// ---------------------------------------------------------------------------

export interface BreakdownKanbanCard {
  id: string;
  ticketNumber: string;
  machineName: string;
  machineLocation: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  breakdownType: string;
  state: string;
  assignedTechnicianId: string | null;
  assignedTechnicianName: string | null;
  reportedAt: Date;
  elapsedMinutes: number;
  slaDeadline: Date | null;
  slaMinutesRemaining: number | null;
  slaBreach: boolean;
}

// ---------------------------------------------------------------------------
// Machine Health / Floor Map
// ---------------------------------------------------------------------------

export interface MachineHealthCell {
  machineId: string;
  machineName: string;
  machineIdCode: string; // short ID for floor map display
  location: string;
  department: string;
  status: AnalyticsMachineStatus;
  healthScore: number;
  openBreakdownCount: number;
  watchFlag: boolean;
  watchFlagLevel: string | null;
  gridRow: number; // position in floor map grid
  gridCol: number;
}

// ---------------------------------------------------------------------------
// Technician Status
// ---------------------------------------------------------------------------

export interface TechnicianStatus {
  userId: string;
  name: string;
  avatarInitials: string;
  currentStatus: TechnicianCurrentStatus;
  currentWoId: string | null;
  currentWoNumber: string | null;
  currentMachineName: string | null;
  jobsCompletedToday: number;
  avgResponseTimeMins: number;
  avgRepairTimeHours: number;
}

// ---------------------------------------------------------------------------
// Analytics Collections
// ---------------------------------------------------------------------------

export interface AnalyticsDaily {
  companyId: string;
  date: string; // "2025-06-15"
  month: string; // "2025-06"
  year: number;
  breakdownsOpened: number;
  breakdownsClosed: number;
  breakdownsOpen: number;
  criticalBreakdowns: number;
  mttrHours: number;
  slaComplianceRate: number;
  wosOpened: number;
  wosCompleted: number;
  pmsCompleted: number;
  pmsMissed: number;
  pmComplianceRate: number;
  productionHoursLost: number;
  maintenanceCostLKR: number;
  partsCostLKR: number;
  laborCostLKR: number;
  contractorCostLKR: number;
  partsIssued: number;
  lowStockAlerts: number;
  trainingCertificatesIssued: number;
  safetyIncidents: number;
  updatedAt: Timestamp;
}

export interface AnalyticsMonthly {
  companyId: string;
  month: string; // "2025-06"
  year: number;
  totalBreakdowns: number;
  avgMttrHours: number;
  avgMtbfDays: number;
  overallSlaCompliance: number;
  totalMaintenanceCost: number;
  totalProductionHoursLost: number;
  pmComplianceRate: number;
  topProblemMachines: TopProblemMachine[];
  technicianPerformance: TechnicianPerformanceRecord[];
  contractorPerformance: ContractorPerformanceRecord[];
  breakdownByType: Record<string, number>;
  breakdownBySeverity: Record<string, number>;
  updatedAt: Timestamp;
}

// ---------------------------------------------------------------------------
// Nested analytics types
// ---------------------------------------------------------------------------

export interface TopProblemMachine {
  machineId: string;
  machineName: string;
  breakdownCount: number;
  downtimeHours: number;
  cost: number;
  criticality: number;
}

export interface TechnicianPerformanceRecord {
  techId: string;
  techName: string;
  jobsCompleted: number;
  avgResponseMins: number;
  avgRepairHours: number;
  slaCompliance: number;
}

export interface ContractorPerformanceRecord {
  contractorId: string;
  contractorName: string;
  jobsCompleted: number;
  avgMttr: number;
  firstFixRate: number;
  slaCompliance: number;
  avgRating: number;
  ratingTrend: 'up' | 'down' | 'stable';
}

// ---------------------------------------------------------------------------
// Heatmap
// ---------------------------------------------------------------------------

export interface HeatmapCell {
  day: number; // 0-6 (Mon-Sun)
  hour: number; // 0-23
  count: number;
  intensity: number; // 0-1 normalized
}

// ---------------------------------------------------------------------------
// Side Panel
// ---------------------------------------------------------------------------

export interface SidePanelState {
  type: 'breakdown' | 'wo' | 'machine' | 'technician' | 'contractor' | null;
  id: string | null;
}

// ---------------------------------------------------------------------------
// Machine Health Document
// ---------------------------------------------------------------------------

export interface MachineHealthDoc {
  companyId: string;
  machineId: string;
  machineIdCode: string;
  machineName: string;
  department: string;
  location: string;
  currentStatus: AnalyticsMachineStatus;
  healthScore: number; // 0-100
  mtbfDays: number;
  mttrHours: number;
  lastBreakdownDate: Timestamp | null;
  lastServiceDate: Timestamp | null;
  nextPmDue: Timestamp | null;
  openBreakdownCount: number;
  openWoCount: number;
  breakdownCountMTD: number;
  maintenanceCostMTD: number;
  watchFlag: boolean;
  watchFlagLevel: 'critical_watch' | 'monitor' | 'info_only' | null;
  updatedAt: Timestamp;
}

// ---------------------------------------------------------------------------
// Technician Status Document
// ---------------------------------------------------------------------------

export interface TechnicianStatusDoc {
  companyId: string;
  userId: string;
  name: string;
  currentStatus: TechnicianCurrentStatus;
  currentWoId: string | null;
  currentWoNumber: string | null;
  currentMachineName: string | null;
  shiftStartTime: Timestamp | null;
  jobsCompletedToday: number;
  avgResponseTimeMins: number; // today
  avgRepairTimeHours: number; // today
  updatedAt: Timestamp;
}

// ---------------------------------------------------------------------------
// Notification Feed
// ---------------------------------------------------------------------------

export type DashboardNotificationType = 'breakdown' | 'work_order' | 'parts' | 'pm' | 'alert';

export interface DashboardNotification {
  id: string;
  type: DashboardNotificationType;
  message: string;
  timestamp: Timestamp;
  severity: 'critical' | 'high' | 'medium' | 'low';
  linkTo: string | null;
  read: boolean;
}

// ---------------------------------------------------------------------------
// SLA Status Widget
// ---------------------------------------------------------------------------

export interface SlaStatusSummary {
  complianceRate: number;
  withinSlaCount: number;
  atRiskCount: number;
  breachedCount: number;
  atRiskItems: Array<{
    breakdownId: string;
    ticketNumber: string;
    machineName: string;
    minutesRemaining: number;
    assignedTechName: string | null;
  }>;
  breachedItems: Array<{
    breakdownId: string;
    ticketNumber: string;
    machineName: string;
    minutesOverdue: number;
    assignedTechName: string | null;
  }>;
}

// ---------------------------------------------------------------------------
// Inventory Dashboard Types
// ---------------------------------------------------------------------------

export interface InventoryHealthStats {
  totalParts: number;
  lowStockItems: number;
  outOfStockItems: number;
  pendingPartsRequests: number;
}

export interface LowStockItem {
  partId: string;
  partName: string;
  partNumber: string;
  category: string;
  currentQty: number;
  minLevel: number;
  deficit: number;
  compatibleMachines: string[];
}

export interface PartsRequestDashboardItem {
  requestId: string;
  requestedBy: string;
  machineName: string;
  woNumber: string | null;
  partName: string;
  qty: number;
  requestedAt: Timestamp;
  valueLKR: number;
  status: string;
}

// ---------------------------------------------------------------------------
// Training Dashboard Types
// ---------------------------------------------------------------------------

export interface TrainingComplianceStats {
  overallComplianceRate: number;
  certificationsExpiring30Days: number;
  certificationsExpired: number;
  traineesInProgress: number;
}

export interface ComplianceByMachine {
  machineName: string;
  requiredOperators: number;
  certified: number;
  expiring: number;
  expired: number;
  compliancePercent: number;
}

export interface OperatorTrainingStatus {
  operatorName: string;
  role: string;
  machinesCertified: number;
  expiringSoon: number;
  lastTrainingDate: Timestamp | null;
  status: 'fully_compliant' | 'action_required' | 'expired';
}

export interface TrainingActivityMonth {
  month: string;
  newCertifications: number;
  renewals: number;
}
