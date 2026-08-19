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
  safety_incidents: [
    { key: 'reportedAt', label: 'Reported' },
    { key: 'type', label: 'Type' },
    { key: 'title', label: 'Case' },
    { key: 'severity', label: 'Severity' },
    { key: 'status', label: 'Status' },
    { key: 'location', label: 'Location' },
    { key: 'reportedByName', label: 'Reported By' },
  ],
  work_permit_history: [
    { key: 'permitNumber', label: 'Permit #' },
    { key: 'category', label: 'Category' },
    { key: 'title', label: 'Title' },
    { key: 'status', label: 'Status' },
    { key: 'validFrom', label: 'Valid From' },
    { key: 'validTo', label: 'Valid To' },
    { key: 'location', label: 'Location' },
    { key: 'requestedByName', label: 'Created By' },
    { key: 'completion', label: 'Completion' },
    { key: 'signedOffByName', label: 'Signed Off By' },
    { key: 'signedOffAt', label: 'Signed Off' },
  ],
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
    // The ticket's lifecycle continues on the Work Order it turned into —
    // these carry it through to sign-off instead of stopping at the ticket.
    { key: 'woNumber', label: 'WO #' },
    { key: 'woStatus', label: 'WO Status' },
    { key: 'woActualStartTime', label: 'WO Started', format: 'datetime' },
    { key: 'woActualEndTime', label: 'WO Ended', format: 'datetime' },
    { key: 'woWorkDoneDescription', label: 'Work Done' },
    { key: 'woSignedOffByName', label: 'Signed Off By' },
    { key: 'woSignedOffAt', label: 'Signed Off At', format: 'datetime' },
    { key: 'woSignOffOutcome', label: 'Sign-Off Outcome' },
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
    { key: 'woTicket', label: 'WO Ticket' },
    { key: 'machineName', label: 'Machine Name' },
    { key: 'location', label: 'Location' },
    { key: 'woType', label: 'WO Type' },
    { key: 'createdAt', label: 'Date of Created', format: 'date' },
    { key: 'downtimeMinutes', label: 'Downtime (min)', format: 'number' },
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
    { key: 'workOrderNumber', label: 'Linked WO' },
    // Whether this issue was handed out as a returnable loan, and — for
    // returnable issues — whether it's actually come back yet.
    { key: 'isReturnable', label: 'Returnable', format: 'bool' },
    { key: 'returnStatus', label: 'Return Status' },
    { key: 'performedByName', label: 'By' },
    { key: 'performedAt', label: 'Date', format: 'date' },
  ],
  low_stock_alert: [
    { key: 'name', label: 'Part Name' },
    { key: 'lowStockAlertDate', label: 'Date of Received Low Stock Alert', format: 'date' },
    { key: 'poStatus', label: 'Status' },
    { key: 'refilledDate', label: 'Refilled Date', format: 'date' },
  ],
  // Exact column set/order requested: Part Number, Part Name, Location,
  // Category, Criticality, Status, Min Stock Level, Available Stock, Unit
  // Cost, Total Cost. Brand/Max Stock Level/Unit/Supplier/Lead Time exist on
  // InventoryPart but are intentionally dropped from this report.
  inventory_listing: [
    { key: 'partNumber', label: 'Part Number' },
    { key: 'name', label: 'Part Name' },
    { key: 'storeLocation', label: 'Location' },
    { key: 'category', label: 'Category' },
    { key: 'criticality', label: 'Criticality' },
    { key: 'status', label: 'Status' },
    { key: 'minStockLevel', label: 'Min Stock Level', format: 'number' },
    { key: 'availableStock', label: 'Available Stock', format: 'number' },
    { key: 'unitCost', label: 'Unit Cost', format: 'currency' },
    // Total value of stock currently held (unitCost x currentStock — the
    // standard inventory-valuation figure), computed in fetchReportRows since
    // it isn't stored on the document. Uses currentStock rather than
    // availableStock so it values everything physically on the shelf,
    // including stock reserved against open work orders/POs, consistent with
    // how "Total Cost" is used as a valuation figure elsewhere in this report
    // set (not a per-transaction cost like Maintenance Cost/PO History).
    { key: 'totalCost', label: 'Total Cost', format: 'currency' },
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
    { key: 'shiftName', label: 'Shift Name' },
    // personName/personRole are normalised across handovers and shift
    // sessions in fetchReportRows so both sources render the same columns
    // the Shift Handovers tab shows.
    { key: 'personName', label: 'Person' },
    { key: 'personRole', label: 'Role' },
    { key: 'department', label: 'Department' },
    { key: 'shiftActualStart', label: 'Shift Started', format: 'datetime' },
    { key: 'lateByMinutes', label: 'Late By (min)', format: 'number' },
    { key: 'shiftActualEnd', label: 'Shift Ended', format: 'datetime' },
    { key: 'otMinutes', label: 'OT (min)', format: 'number' },
    { key: 'breakdownsOpened', label: 'Breakdowns during Shift', format: 'number' },
    { key: 'wosOpened', label: 'WOs during Shift', format: 'number' },
    { key: 'watchFlagsCount', label: 'Watch Flags', format: 'number' },
  ],
  training_compliance: [
    { key: 'name', label: 'Name' },
    { key: 'role', label: 'Role' },
    { key: 'trainingsAssigned', label: 'No. of Trainings Assigned', format: 'number' },
    { key: 'trainingsCompleted', label: 'No. of Trainings Completed', format: 'number' },
    { key: 'totalMarks', label: 'Total Marks', format: 'number' },
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
    { key: 'date', label: 'Date', format: 'date' },
    { key: 'categoryLabel', label: 'Category' },
    { key: 'scopeDetails', label: 'Scope Details' },
    { key: 'doneBy', label: 'Done By' },
    { key: 'participants', label: 'Participants', format: 'list' },
    { key: 'marks', label: 'Marks', format: 'number' },
  ],
  po_history: [
    { key: 'poNumber', label: 'PO Code' },
    { key: 'supplierName', label: 'Supplier' },
    { key: 'itemName', label: 'Item' },
    { key: 'quantity', label: 'Quantity', format: 'number' },
    // Final invoice-confirmed unit price — most recent invoiceRevisions entry
    // for this item, falling back to the PO item's own unitCost.
    { key: 'unitPrice', label: 'Unit Price', format: 'currency' },
    { key: 'lineTotal', label: 'Total', format: 'currency' },
    { key: 'status', label: 'Status' },
    { key: 'raisedByName', label: 'Raised By' },
    { key: 'raisedAt', label: 'Date', format: 'date' },
    { key: 'receivedAt', label: 'Received Date', format: 'date' },
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
