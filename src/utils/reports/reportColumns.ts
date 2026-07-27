import type { ReportType } from '../../types/reports.types';

export type ColumnFormat = 'date' | 'datetime' | 'currency' | 'number' | 'list' | 'bool' | 'text';

export interface ReportColumn {
  key: string;
  label: string;
  format?: ColumnFormat;
}

const titleCase = (value: string) =>
  value
    .replace(/([A-Z])/g, ' $1')
    .replace(/[_-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (m) => m.toUpperCase());

function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (typeof value === 'object' && 'seconds' in (value as Record<string, unknown>)) {
    return new Date(Number((value as { seconds: number }).seconds) * 1000);
  }
  if (value instanceof Date) return value;
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Formats a single cell value. Numbers/currency are returned as numbers so
 * spreadsheets can still aggregate them; everything else is a display string.
 */
export function formatCell(value: unknown, format?: ColumnFormat): string | number {
  if (value == null || value === '') return '';
  switch (format) {
    case 'date': {
      const d = toDate(value);
      return d ? d.toLocaleDateString() : String(value);
    }
    case 'datetime': {
      const d = toDate(value);
      return d ? d.toLocaleString() : String(value);
    }
    case 'currency':
    case 'number': {
      const n = Number(value);
      return Number.isFinite(n) ? n : String(value);
    }
    case 'list':
      return Array.isArray(value) ? value.join(', ') : String(value);
    case 'bool':
      return value ? 'Yes' : 'No';
    default:
      if (typeof value === 'object') {
        const d = toDate(value);
        if (d) return d.toLocaleString();
        return JSON.stringify(value);
      }
      return String(value);
  }
}

// Curated columns per report. Reports not listed fall back to the document's
// own fields (see resolveColumns).
export const REPORT_COLUMNS: Partial<Record<ReportType, ReportColumn[]>> = {
  breakdown_summary: [
    { key: 'ticketNumber', label: 'Ticket' },
    { key: 'machineName', label: 'Machine' },
    { key: 'machineDepartment', label: 'Department' },
    { key: 'severity', label: 'Severity' },
    { key: 'type', label: 'Type' },
    { key: 'status', label: 'Status' },
    { key: 'reportedAt', label: 'Reported Date', format: 'date' },
    { key: 'resolvedAt', label: 'Completed', format: 'date' },
    { key: 'rcaReason', label: 'RCA Reason' },
  ],
  sla_compliance: [
    { key: 'ticketNumber', label: 'Ticket' },
    { key: 'machineName', label: 'Machine' },
    { key: 'severity', label: 'Severity' },
    { key: 'status', label: 'Status' },
    { key: 'slaDeadline', label: 'SLA Deadline', format: 'datetime' },
    { key: 'slaBreached', label: 'Breached', format: 'bool' },
    { key: 'reportedAt', label: 'Reported', format: 'date' },
    { key: 'resolvedAt', label: 'Resolved', format: 'date' },
  ],
  downtime_analysis: [
    { key: 'ticketNumber', label: 'Ticket' },
    { key: 'machineName', label: 'Machine' },
    { key: 'machineDepartment', label: 'Department' },
    { key: 'type', label: 'Type' },
    { key: 'estimatedDowntimeMinutes', label: 'Downtime (min)', format: 'number' },
    { key: 'unitsLostOnStop', label: 'Units Lost', format: 'number' },
    { key: 'status', label: 'Status' },
    { key: 'reportedAt', label: 'Reported', format: 'date' },
  ],
  work_order_detail: [
    { key: 'woNumber', label: 'WO #' },
    { key: 'woType', label: 'Type' },
    { key: 'priority', label: 'Priority' },
    { key: 'status', label: 'Status' },
    { key: 'machineName', label: 'Machine' },
    { key: 'machineDepartment', label: 'Department' },
    // All people who participated in the work — assigned technicians plus any
    // contractor technicians (see `participants` enrichment in fetchReportRows).
    { key: 'participants', label: 'Participants', format: 'list' },
    { key: 'createdByName', label: 'Created By' },
    { key: 'supervisorSignOffByName', label: 'Signed Off By' },
    { key: 'createdAt', label: 'Created', format: 'date' },
    { key: 'actualEndTime', label: 'Completed', format: 'date' },
    { key: 'supervisorSignOffAt', label: 'Signed Off', format: 'date' },
  ],
  maintenance_cost: [
    { key: 'woTicket', label: 'WO Ticket' },
    { key: 'woType', label: 'WO Type' },
    { key: 'machineName', label: 'Machine' },
    { key: 'machineDepartment', label: 'Department' },
    // Single, all-in figure: parts cost + labor + contractor total project
    // cost (auto-parts + contractor's own cost, from sign-off) already
    // summed per work order in fetchReportRows.
    { key: 'totalCost', label: 'Total Cost', format: 'currency' },
    { key: 'signedOffDate', label: 'Signed Off Date', format: 'date' },
  ],
  technician_performance: [
    { key: 'name', label: 'Name' },
    { key: 'role', label: 'Role' },
    { key: 'evaluationScore', label: 'Evaluation Score', format: 'number' },
    { key: 'auditScore', label: 'Audit Score', format: 'number' },
    { key: 'trainingsCompleted', label: 'Trainings Completed', format: 'number' },
    { key: 'quizzesPassed', label: 'Quizzes Passed', format: 'number' },
  ],
  contractor_performance: [
    { key: 'contractorName', label: 'Name' },
    { key: 'wosCompleted', label: 'WOs Completed', format: 'number' },
    { key: 'rating', label: 'Rating', format: 'number' },
    { key: 'signedOffDate', label: 'Signed Off Date', format: 'date' },
    { key: 'signedOffByName', label: 'Signed Off By' },
    { key: 'totalProjectCost', label: 'Total Project Cost', format: 'currency' },
  ],
  inventory_usage: [
    { key: 'partNumber', label: 'Part #' },
    { key: 'partName', label: 'Part' },
    { key: 'movementType', label: 'Movement' },
    { key: 'quantityChange', label: 'Qty Change', format: 'number' },
    { key: 'quantityAfter', label: 'Qty After', format: 'number' },
    { key: 'totalCostImpact', label: 'Cost Impact', format: 'currency' },
    { key: 'performedByName', label: 'By' },
    { key: 'performedAt', label: 'Date', format: 'date' },
  ],
  parts_consumption: [
    { key: 'partNumber', label: 'Part #' },
    { key: 'partName', label: 'Part' },
    { key: 'movementType', label: 'Movement' },
    { key: 'quantityChange', label: 'Qty Change', format: 'number' },
    { key: 'totalCostImpact', label: 'Cost Impact', format: 'currency' },
    { key: 'performedByName', label: 'By' },
    { key: 'performedAt', label: 'Date', format: 'date' },
  ],
  low_stock_alert: [
    { key: 'partNumber', label: 'Part #' },
    { key: 'name', label: 'Name' },
    { key: 'brand', label: 'Brand' },
    { key: 'category', label: 'Category' },
    { key: 'currentStock', label: 'Current', format: 'number' },
    { key: 'minStockLevel', label: 'Min', format: 'number' },
    { key: 'unit', label: 'Unit' },
  ],
  inventory_listing: [
    { key: 'partNumber', label: 'Part #' },
    { key: 'name', label: 'Name' },
    { key: 'brand', label: 'Brand' },
    { key: 'category', label: 'Category' },
    { key: 'status', label: 'Status' },
    { key: 'criticality', label: 'Criticality' },
    { key: 'currentStock', label: 'Current Stock', format: 'number' },
    { key: 'minStockLevel', label: 'Min Level', format: 'number' },
    { key: 'maxStockLevel', label: 'Max Level', format: 'number' },
    { key: 'availableStock', label: 'Available', format: 'number' },
    { key: 'unit', label: 'Unit' },
    { key: 'unitCost', label: 'Unit Cost', format: 'currency' },
    { key: 'storeLocation', label: 'Location' },
    { key: 'supplierName', label: 'Supplier' },
    { key: 'leadTimeDays', label: 'Lead Time (days)', format: 'number' },
  ],
  pm_compliance: [
    { key: 'scheduleName', label: 'Schedule' },
    { key: 'machineName', label: 'Machine' },
    { key: 'dueDate', label: 'Due', format: 'date' },
    { key: 'completedDate', label: 'Completed', format: 'date' },
    { key: 'status', label: 'Status' },
    { key: 'daysOverdue', label: 'Days Overdue', format: 'number' },
    { key: 'technicianNames', label: 'Technicians', format: 'list' },
  ],
  machine_health_score: [
    { key: 'machineName', label: 'Machine' },
    { key: 'machineIdCode', label: 'Asset Code' },
    { key: 'department', label: 'Department' },
    { key: 'currentStatus', label: 'Status' },
    { key: 'healthScore', label: 'Health Score', format: 'number' },
    { key: 'watchFlagLevel', label: 'Watch Level' },
    { key: 'mtbfDays', label: 'MTBF (days)', format: 'number' },
    { key: 'mttrHours', label: 'MTTR (hours)', format: 'number' },
    { key: 'openBreakdownCount', label: 'Open Breakdowns', format: 'number' },
    { key: 'openWoCount', label: 'Open WOs', format: 'number' },
    { key: 'maintenanceCostMTD', label: 'Cost MTD', format: 'currency' },
    { key: 'lastServiceDate', label: 'Last Service', format: 'date' },
    { key: 'nextPmDue', label: 'Next PM', format: 'date' },
  ],
  shift_handover_summary: [
    { key: 'shiftName', label: 'Shift' },
    { key: 'shiftDate', label: 'Date', format: 'date' },
    { key: 'outgoingSupervisorName', label: 'Outgoing Supervisor' },
    { key: 'incomingSupervisorName', label: 'Incoming Supervisor' },
    { key: 'status', label: 'Status' },
    { key: 'overlapMinutes', label: 'Overlap (min)', format: 'number' },
    { key: 'wosOpened', label: 'WOs Opened', format: 'number' },
    { key: 'wosCompleted', label: 'WOs Completed', format: 'number' },
    { key: 'wosPending', label: 'WOs Pending', format: 'number' },
    { key: 'breakdownsOpened', label: 'Breakdowns Opened', format: 'number' },
    { key: 'breakdownsCarriedOver', label: 'Breakdowns Carried Over', format: 'number' },
    { key: 'safetyIncidentOccurred', label: 'Safety Incident', format: 'bool' },
    { key: 'generalNotes', label: 'Notes' },
  ],
  safety_near_miss: [
    { key: 'shiftName', label: 'Shift' },
    { key: 'shiftDate', label: 'Date', format: 'date' },
    { key: 'outgoingSupervisorName', label: 'Reported By (Supervisor)' },
    { key: 'safetyIncidentOccurred', label: 'Incident Occurred', format: 'bool' },
    { key: 'safetyIncidentDescription', label: 'Description' },
    { key: 'status', label: 'Handover Status' },
  ],
  training_compliance: [
    { key: 'traineeName', label: 'Trainee' },
    { key: 'department', label: 'Department' },
    { key: 'machineName', label: 'Machine' },
    { key: 'moduleName', label: 'Training Module' },
    { key: 'status', label: 'Status' },
    { key: 'assignedAt', label: 'Assigned', format: 'date' },
    { key: 'dueDate', label: 'Due', format: 'date' },
    { key: 'certifiedAt', label: 'Certified', format: 'date' },
    { key: 'certificateExpiryDate', label: 'Certificate Expiry', format: 'date' },
  ],
  machine_history: [
    { key: 'machineName', label: 'Machine Name' },
    { key: 'machineType', label: 'Type' },
    { key: 'purchaseDate', label: 'Purchased Date', format: 'date' },
    { key: 'installationDate', label: 'Installed Date', format: 'date' },
    { key: 'department', label: 'Department' },
    { key: 'location', label: 'Location' },
    { key: 'lastServiceDate', label: 'Last Service Date', format: 'date' },
    { key: 'lastServiceType', label: 'Last Service Type' },
    { key: 'nextPmDue', label: 'Next PM Date', format: 'date' },
  ],
  executive_monthly: [
    { key: 'metric', label: 'Metric' },
    { key: 'value', label: 'Value' },
  ],
  audit_trail: [
    { key: 'timestamp', label: 'Timestamp', format: 'datetime' },
    { key: 'userName', label: 'User' },
    { key: 'userRole', label: 'Role' },
    { key: 'action', label: 'Action' },
    { key: 'entityType', label: 'Entity' },
    { key: 'entityName', label: 'Name' },
  ],
  po_history: [
    { key: 'poNumber', label: 'PO Code' },
    { key: 'supplierName', label: 'Supplier' },
    { key: 'partNames', label: 'Parts', format: 'list' },
    { key: 'partQuantities', label: 'Quantity', format: 'list' },
    // Final invoice-priced total (see `finalTotalCost` enrichment in
    // fetchReportRows) — falls back to the PO's own total when no invoice
    // revision was ever recorded.
    { key: 'finalTotalCost', label: 'Total Cost', format: 'currency' },
    { key: 'raisedAt', label: 'Requested Date', format: 'date' },
    { key: 'receivedAt', label: 'Delivered Date', format: 'date' },
    { key: 'status', label: 'Progress' },
  ],
};

/**
 * Returns the columns to use for a report. If no curated definition exists,
 * derives columns from the first row's own fields.
 */
export function resolveColumns(reportType: ReportType, rows: Record<string, unknown>[]): ReportColumn[] {
  const defined = REPORT_COLUMNS[reportType];
  if (defined && defined.length > 0) {
    // Only keep columns that at least one row actually has data for.
    const present = defined.filter((col) => rows.some((r) => r[col.key] != null && r[col.key] !== ''));
    return present.length > 0 ? present : defined;
  }
  if (!rows[0]) return [{ key: 'id', label: 'ID' }];
  return Object.keys(rows[0])
    .filter((k) => k !== 'id' && k !== 'companyId')
    .slice(0, 10)
    .map((k) => ({ key: k, label: titleCase(k) }));
}

/**
 * Same as formatCell, but date/datetime values are returned as real JS Date
 * objects instead of pre-formatted strings. xlsx (SheetJS) writes a Date
 * value as a genuine Excel date cell (numeric serial + date number format),
 * so the column stays sortable/filterable as a date in Excel. formatCell
 * still returns strings for CSV/PDF/on-screen preview, where a literal date
 * string is exactly what's wanted.
 */
export function formatCellForExcel(value: unknown, format?: ColumnFormat): string | number | Date {
  if (format === 'date' || format === 'datetime') {
    const d = toDate(value);
    if (d) return d;
  }
  return formatCell(value, format);
}

/** Maps rows into label-keyed objects for spreadsheet export. */
export function mapRowsToColumns(
  columns: ReportColumn[],
  rows: Record<string, unknown>[],
): Record<string, string | number | Date>[] {
  return rows.map((row) => {
    const out: Record<string, string | number | Date> = {};
    columns.forEach((col) => {
      out[col.label] = formatCellForExcel(row[col.key], col.format);
    });
    return out;
  });
}
