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
    { key: 'reporterName', label: 'Reported By' },
    { key: 'reportedAt', label: 'Reported', format: 'date' },
    { key: 'estimatedDowntimeMinutes', label: 'Downtime (min)', format: 'number' },
    { key: 'description', label: 'Description' },
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
    { key: 'assignedTechnicianNames', label: 'Technicians', format: 'list' },
    { key: 'supervisorInChargeName', label: 'Supervisor' },
    { key: 'dueDate', label: 'Due', format: 'date' },
    { key: 'createdAt', label: 'Created', format: 'date' },
    { key: 'totalDurationMinutes', label: 'Duration (min)', format: 'number' },
  ],
  technician_performance: [
    { key: 'woNumber', label: 'WO #' },
    { key: 'woType', label: 'Type' },
    { key: 'status', label: 'Status' },
    { key: 'assignedTechnicianNames', label: 'Technicians', format: 'list' },
    { key: 'machineName', label: 'Machine' },
    { key: 'totalDurationMinutes', label: 'Duration (min)', format: 'number' },
    { key: 'testRunResult', label: 'Test Result' },
    { key: 'createdAt', label: 'Created', format: 'date' },
  ],
  contractor_performance: [
    { key: 'workOrderNumber', label: 'WO #' },
    { key: 'contractorName', label: 'Contractor' },
    { key: 'workOrderType', label: 'Type' },
    { key: 'machineName', label: 'Machine' },
    { key: 'status', label: 'Status' },
    { key: 'onSiteDurationMinutes', label: 'On-site (min)', format: 'number' },
    { key: 'systemInvoiceAmount', label: 'Invoice', format: 'currency' },
    { key: 'createdAt', label: 'Created', format: 'date' },
  ],
  contractor_invoice_comparison: [
    { key: 'workOrderNumber', label: 'WO #' },
    { key: 'contractorName', label: 'Contractor' },
    { key: 'systemInvoiceAmount', label: 'System Amount', format: 'currency' },
    { key: 'status', label: 'Status' },
    { key: 'createdAt', label: 'Created', format: 'date' },
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
  pm_compliance: [
    { key: 'scheduleName', label: 'Schedule' },
    { key: 'machineName', label: 'Machine' },
    { key: 'dueDate', label: 'Due', format: 'date' },
    { key: 'completedDate', label: 'Completed', format: 'date' },
    { key: 'status', label: 'Status' },
    { key: 'daysOverdue', label: 'Days Overdue', format: 'number' },
    { key: 'technicianNames', label: 'Technicians', format: 'list' },
  ],
  machine_history: [
    { key: 'name', label: 'Machine' },
    { key: 'type', label: 'Type' },
    { key: 'department', label: 'Department' },
    { key: 'status', label: 'Status' },
    { key: 'criticality', label: 'Criticality', format: 'number' },
    { key: 'healthScore', label: 'Health', format: 'number' },
    { key: 'lastServiceDate', label: 'Last Service', format: 'date' },
    { key: 'nextPmDue', label: 'Next PM', format: 'date' },
  ],
  audit_trail: [
    { key: 'timestamp', label: 'Timestamp', format: 'datetime' },
    { key: 'userName', label: 'User' },
    { key: 'userRole', label: 'Role' },
    { key: 'action', label: 'Action' },
    { key: 'entityType', label: 'Entity' },
    { key: 'entityName', label: 'Name' },
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

/** Maps rows into label-keyed objects for spreadsheet export. */
export function mapRowsToColumns(
  columns: ReportColumn[],
  rows: Record<string, unknown>[],
): Record<string, string | number>[] {
  return rows.map((row) => {
    const out: Record<string, string | number> = {};
    columns.forEach((col) => {
      out[col.label] = formatCell(row[col.key], col.format);
    });
    return out;
  });
}
