export type ReportType =
  | 'breakdown_summary'
  | 'work_order_detail'
  | 'machine_history'
  | 'machine_health_score'
  | 'maintenance_cost'
  | 'technician_performance'
  | 'contractor_performance'
  | 'inventory_usage'
  | 'inventory_listing'
  | 'low_stock_alert'
  | 'pm_compliance'
  | 'training_compliance'
  | 'sla_compliance'
  | 'shift_handover_summary'
  | 'downtime_analysis'
  | 'executive_monthly'
  | 'audit_trail'
  | 'po_history'
  | 'safety_incidents'
  | 'work_permit_history';

export type QuickDateRange =
  | 'today'
  | 'yesterday'
  | 'this_week'
  | 'last_week'
  | 'this_month'
  | 'last_month'
  | 'last_3_months'
  | 'last_6_months'
  | 'this_year'
  | 'custom';

export type ExportFormat = 'pdf' | 'excel' | 'google_sheets' | 'csv';

export type ReportCategory =
  | 'breakdowns'
  | 'work_orders'
  | 'machines'
  | 'inventory'
  | 'people'
  | 'compliance'
  | 'financial'
  | 'executive';

export type FilterType =
  | 'machine'
  | 'department'
  | 'severity'
  | 'wo_type'
  | 'breakdown_type'
  | 'technician'
  | 'contractor'
  | 'part_category'
  | 'shift'
  | 'supervisor'
  | 'priority'
  | 'training_status'
  | 'training_type'
  | 'sla_status';

export interface ReportDefinition {
  type: ReportType;
  name: string;
  description: string;
  category: ReportCategory;
  icon: string;
  supportsPdf: boolean;
  supportsExcel: boolean;
  primaryUsers: string[];
  availableFilters: FilterType[];
  estimatedGenerationSecs: number;
  /**
   * Whether the report's data is actually scoped by the Date Range picker.
   * Registry/snapshot and lifetime-rollup reports (current machine state,
   * current inventory levels, lifetime training/evaluation totals) have no
   * per-row date to filter on — fetchReportRows ignores dateFrom/dateTo for
   * them entirely, so showing the picker made it look broken. Defaults to
   * true; set false to hide the picker and explain why instead.
   */
  supportsDateRange?: boolean;
}

export interface ReportConfig {
  dateFrom: string;
  dateTo: string;
  quickRange: QuickDateRange;
  machines: string[];
  departments: string[];
  severities: string[];
  woTypes: string[];
  breakdownTypes: string[];
  technicians: string[];
  contractors: string[];
  partCategories: string[];
  shifts: string[];
  supervisors: string[];
  priorities: string[];
  trainingStatuses: string[];
  trainingTypes: string[];
  slaStatuses: string[];
  outputFormat: ExportFormat;
  includeCharts: boolean;
  includeDataTable: boolean;
  paperSize: 'A4' | 'Letter';
  orientation: 'portrait' | 'landscape';
}

export interface ReportHistory {
  id: string;
  companyId: string;
  reportType: ReportType;
  reportName: string;
  generatedBy: string;
  generatedByName: string;
  generatedAt: Date;
  format: ExportFormat;
  dateRangeFrom: string;
  dateRangeTo: string;
  filters: Record<string, unknown>;
  storageUrl: string | null;
  downloadUrl: string | null;
  googleSheetsUrl: string | null;
  fileSizeBytes: number | null;
  generationTimeMs: number;
  status: 'generating' | 'ready' | 'failed';
  errorMessage: string | null;
  pageCount: number | null;
  rowCount: number | null;
  expiresAt: Date;
}

export interface ReportHistoryFilters {
  reportType: ReportType | 'all';
  format: ExportFormat | 'all';
  generatedBy: string;
  dateFrom: string;
  dateTo: string;
}

export interface ExcelSheetConfig {
  name: string;
  headers: string[];
  data: Record<string, unknown>[];
}

export interface ExcelExportConfig {
  reportName: string;
  dateRange: string;
  sheets: ExcelSheetConfig[];
}

export type AuditAction =
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'VIEW'
  | 'LOGIN'
  | 'LOGOUT'
  | 'EXPORT'
  | 'APPROVE'
  | 'REJECT'
  | 'ASSIGN'
  | 'SIGN_OFF';

export type AuditEntityType =
  | 'breakdown'
  | 'work_order'
  | 'machine'
  | 'inventory'
  | 'user'
  | 'contractor'
  | 'pm_schedule'
  | 'training'
  | 'report';

export interface AuditChange {
  field: string;
  before: unknown;
  after: unknown;
}

export interface AuditLog {
  id: string;
  companyId: string;
  timestamp: Date;
  userId: string;
  userName: string;
  userRole: string;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: string;
  entityName: string;
  changes: AuditChange[] | null;
  ipAddress: string | null;
  userAgent: string | null;
  sessionId: string | null;
}


export interface GenerateReportResult {
  reportId: string;
  downloadUrl: string;
  storageUrl?: string;
  pageCount: number | null;
  generationTimeMs: number;
}

export interface PushToSheetsResult {
  sheetsUrl: string;
  spreadsheetId: string;
}
