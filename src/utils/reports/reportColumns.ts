import type { TFunction } from 'i18next';
import type { ReportType } from '../../types/reports.types';
import { formatShortDate, formatShortDateTime } from '../../lib/i18nDate';

export type ColumnFormat = 'date' | 'datetime' | 'currency' | 'number' | 'list' | 'bool' | 'text';

export interface ReportColumn {
  key: string;
  /** English fallback label — used verbatim when no `t` is supplied. */
  label: string;
  /** i18n key resolved via `getColumnLabel`/`resolveColumns` when a `t` is available. */
  labelKey?: string;
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
export function formatCell(value: unknown, format?: ColumnFormat, t?: TFunction): string | number {
  if (value == null || value === '') return '';
  switch (format) {
    case 'date': {
      const d = toDate(value);
      return d ? formatShortDate(d) : String(value);
    }
    case 'datetime': {
      const d = toDate(value);
      return d ? formatShortDateTime(d) : String(value);
    }
    case 'currency':
    case 'number': {
      const n = Number(value);
      return Number.isFinite(n) ? n : String(value);
    }
    case 'list':
      return Array.isArray(value) ? value.join(', ') : String(value);
    case 'bool':
      return value
        ? t ? t('common.reports.shared.yes', { defaultValue: 'Yes' }) : 'Yes'
        : t ? t('common.reports.shared.no', { defaultValue: 'No' }) : 'No';
    default:
      if (typeof value === 'object') {
        const d = toDate(value);
        if (d) return formatShortDateTime(d);
        return JSON.stringify(value);
      }
      return String(value);
  }
}

/**
 * Resolves a column's display label. Pass `t` (from `useTranslation()`) to
 * get the translated label; omit it (non-component callers with no `t` on
 * hand) to fall back to the English `label` text — same optional-`t`
 * shape as `buildRange` in MoeMachineFilter.tsx.
 */
export function getColumnLabel(column: ReportColumn, t?: TFunction): string {
  if (t && column.labelKey) return t(column.labelKey, { defaultValue: column.label });
  return column.label;
}

// Curated columns per report. Reports not listed fall back to the document's
// own fields (see resolveColumns). `labelKey` paths live under
// `common.reports.columns.<reportType>.<key>` in the locale files; `label`
// stays as the English fallback text for callers that omit `t`.
export const REPORT_COLUMNS: Partial<Record<ReportType, ReportColumn[]>> = {
  safety_incidents: [
    { key: 'reportedAt', label: 'Reported', labelKey: 'common.reports.columns.safety_incidents.reportedAt' },
    { key: 'type', label: 'Type', labelKey: 'common.reports.columns.safety_incidents.type' },
    { key: 'title', label: 'Case', labelKey: 'common.reports.columns.safety_incidents.title' },
    { key: 'severity', label: 'Severity', labelKey: 'common.reports.columns.safety_incidents.severity' },
    { key: 'status', label: 'Status', labelKey: 'common.reports.columns.safety_incidents.status' },
    { key: 'location', label: 'Location', labelKey: 'common.reports.columns.safety_incidents.location' },
    { key: 'reportedByName', label: 'Reported By', labelKey: 'common.reports.columns.safety_incidents.reportedByName' },
  ],
  work_permit_history: [
    { key: 'permitNumber', label: 'Permit #', labelKey: 'common.reports.columns.work_permit_history.permitNumber' },
    { key: 'category', label: 'Category', labelKey: 'common.reports.columns.work_permit_history.category' },
    { key: 'title', label: 'Title', labelKey: 'common.reports.columns.work_permit_history.title' },
    { key: 'status', label: 'Status', labelKey: 'common.reports.columns.work_permit_history.status' },
    { key: 'validFrom', label: 'Valid From', labelKey: 'common.reports.columns.work_permit_history.validFrom' },
    { key: 'validTo', label: 'Valid To', labelKey: 'common.reports.columns.work_permit_history.validTo' },
    { key: 'location', label: 'Location', labelKey: 'common.reports.columns.work_permit_history.location' },
    { key: 'requestedByName', label: 'Created By', labelKey: 'common.reports.columns.work_permit_history.requestedByName' },
    { key: 'completion', label: 'Completion', labelKey: 'common.reports.columns.work_permit_history.completion' },
    { key: 'signedOffByName', label: 'Signed Off By', labelKey: 'common.reports.columns.work_permit_history.signedOffByName' },
    { key: 'signedOffAt', label: 'Signed Off', labelKey: 'common.reports.columns.work_permit_history.signedOffAt' },
  ],
  // Curated "case file" field set per ticket, grouped under its machine by
  // genericReportPdf's machine-grouped rendering. Every field here is one the
  // user explicitly asked to see — not a generic superset of the underlying
  // documents.
  breakdown_summary: [
    { key: 'ticketNumber', label: 'Ticket', labelKey: 'common.reports.columns.breakdown_summary.ticketNumber' },
    { key: 'severity', label: 'Severity', labelKey: 'common.reports.columns.breakdown_summary.severity' },
    { key: 'description', label: 'What Happened (Reported)', labelKey: 'common.reports.columns.breakdown_summary.description' },
    { key: 'attemptedFixes', label: 'Attempted Fixes', labelKey: 'common.reports.columns.breakdown_summary.attemptedFixes' },
    { key: 'technicianFindings', label: 'What Happened (Technician/Trainee)', labelKey: 'common.reports.columns.breakdown_summary.technicianFindings' },
    { key: 'assignedTechnicianNames', label: 'Assigned Technicians', format: 'list', labelKey: 'common.reports.columns.breakdown_summary.assignedTechnicianNames' },
    { key: 'woNumber', label: 'Work Order #', labelKey: 'common.reports.columns.breakdown_summary.woNumber' },
    { key: 'woAssignedTechnicianNames', label: 'WO Assigned Technicians', format: 'list', labelKey: 'common.reports.columns.breakdown_summary.woAssignedTechnicianNames' },
    { key: 'woChecklist', label: 'Checklist (Supervisor)', format: 'list', labelKey: 'common.reports.columns.breakdown_summary.woChecklist' },
    { key: 'woRootCause', label: 'Root Cause Analysis', labelKey: 'common.reports.columns.breakdown_summary.woRootCause' },
    { key: 'woPartsUsed', label: 'Used Parts', format: 'list', labelKey: 'common.reports.columns.breakdown_summary.woPartsUsed' },
    { key: 'woSignOffNotes', label: 'Signed-Off Note', labelKey: 'common.reports.columns.breakdown_summary.woSignOffNotes' },
    { key: 'woSignedOffAt', label: 'Sign-Off Time (WO)', format: 'datetime', labelKey: 'common.reports.columns.breakdown_summary.woSignedOffAt' },
  ],
  sla_compliance: [
    { key: 'ticketNumber', label: 'Ticket', labelKey: 'common.reports.columns.sla_compliance.ticketNumber' },
    { key: 'machineName', label: 'Machine', labelKey: 'common.reports.columns.sla_compliance.machineName' },
    { key: 'severity', label: 'Severity', labelKey: 'common.reports.columns.sla_compliance.severity' },
    { key: 'status', label: 'Status', labelKey: 'common.reports.columns.sla_compliance.status' },
    { key: 'slaDeadline', label: 'SLA Deadline', format: 'datetime', labelKey: 'common.reports.columns.sla_compliance.slaDeadline' },
    { key: 'slaBreached', label: 'Breached', format: 'bool', labelKey: 'common.reports.columns.sla_compliance.slaBreached' },
    { key: 'reportedAt', label: 'Reported', format: 'date', labelKey: 'common.reports.columns.sla_compliance.reportedAt' },
    { key: 'resolvedAt', label: 'Resolved', format: 'date', labelKey: 'common.reports.columns.sla_compliance.resolvedAt' },
  ],
  downtime_analysis: [
    { key: 'woTicket', label: 'WO Ticket', labelKey: 'common.reports.columns.downtime_analysis.woTicket' },
    { key: 'machineName', label: 'Machine Name', labelKey: 'common.reports.columns.downtime_analysis.machineName' },
    { key: 'location', label: 'Location', labelKey: 'common.reports.columns.downtime_analysis.location' },
    { key: 'woType', label: 'WO Type', labelKey: 'common.reports.columns.downtime_analysis.woType' },
    { key: 'createdAt', label: 'Date of Created', format: 'date', labelKey: 'common.reports.columns.downtime_analysis.createdAt' },
    { key: 'downtimeMinutes', label: 'Downtime (min)', format: 'number', labelKey: 'common.reports.columns.downtime_analysis.downtimeMinutes' },
  ],
  work_order_detail: [
    { key: 'woNumber', label: 'WO #', labelKey: 'common.reports.columns.work_order_detail.woNumber' },
    { key: 'woType', label: 'Type', labelKey: 'common.reports.columns.work_order_detail.woType' },
    { key: 'priority', label: 'Priority', labelKey: 'common.reports.columns.work_order_detail.priority' },
    { key: 'status', label: 'Status', labelKey: 'common.reports.columns.work_order_detail.status' },
    { key: 'machineName', label: 'Machine', labelKey: 'common.reports.columns.work_order_detail.machineName' },
    { key: 'machineDepartment', label: 'Department', labelKey: 'common.reports.columns.work_order_detail.machineDepartment' },
    // All people who participated in the work — assigned technicians plus any
    // contractor technicians (see `participants` enrichment in fetchReportRows).
    { key: 'participants', label: 'Participants', format: 'list', labelKey: 'common.reports.columns.work_order_detail.participants' },
    { key: 'createdByName', label: 'Created By', labelKey: 'common.reports.columns.work_order_detail.createdByName' },
    { key: 'supervisorSignOffByName', label: 'Signed Off By', labelKey: 'common.reports.columns.work_order_detail.supervisorSignOffByName' },
    { key: 'createdAt', label: 'Created', format: 'date', labelKey: 'common.reports.columns.work_order_detail.createdAt' },
    { key: 'actualEndTime', label: 'Completed', format: 'date', labelKey: 'common.reports.columns.work_order_detail.actualEndTime' },
    { key: 'supervisorSignOffAt', label: 'Signed Off', format: 'date', labelKey: 'common.reports.columns.work_order_detail.supervisorSignOffAt' },
  ],
  maintenance_cost: [
    { key: 'woTicket', label: 'WO Ticket', labelKey: 'common.reports.columns.maintenance_cost.woTicket' },
    { key: 'woType', label: 'WO Type', labelKey: 'common.reports.columns.maintenance_cost.woType' },
    { key: 'machineName', label: 'Machine', labelKey: 'common.reports.columns.maintenance_cost.machineName' },
    { key: 'machineDepartment', label: 'Department', labelKey: 'common.reports.columns.maintenance_cost.machineDepartment' },
    // Single, all-in figure: parts cost + labor + contractor total project
    // cost (auto-parts + contractor's own cost, from sign-off) already
    // summed per work order in fetchReportRows.
    { key: 'totalCost', label: 'Total Cost', format: 'currency', labelKey: 'common.reports.columns.maintenance_cost.totalCost' },
    { key: 'signedOffDate', label: 'Signed Off Date', format: 'date', labelKey: 'common.reports.columns.maintenance_cost.signedOffDate' },
  ],
  technician_performance: [
    { key: 'name', label: 'Name', labelKey: 'common.reports.columns.technician_performance.name' },
    { key: 'role', label: 'Role', labelKey: 'common.reports.columns.technician_performance.role' },
    { key: 'evaluationScore', label: 'Evaluation Score', format: 'number', labelKey: 'common.reports.columns.technician_performance.evaluationScore' },
    { key: 'auditScore', label: 'Audit Score', format: 'number', labelKey: 'common.reports.columns.technician_performance.auditScore' },
    { key: 'trainingsCompleted', label: 'Trainings Completed', format: 'number', labelKey: 'common.reports.columns.technician_performance.trainingsCompleted' },
    { key: 'quizzesPassed', label: 'Quizzes Passed', format: 'number', labelKey: 'common.reports.columns.technician_performance.quizzesPassed' },
  ],
  contractor_performance: [
    { key: 'contractorName', label: 'Name', labelKey: 'common.reports.columns.contractor_performance.contractorName' },
    { key: 'wosCompleted', label: 'WOs Completed', format: 'number', labelKey: 'common.reports.columns.contractor_performance.wosCompleted' },
    { key: 'rating', label: 'Rating', format: 'number', labelKey: 'common.reports.columns.contractor_performance.rating' },
    { key: 'signedOffDate', label: 'Signed Off Date', format: 'date', labelKey: 'common.reports.columns.contractor_performance.signedOffDate' },
    { key: 'signedOffByName', label: 'Signed Off By', labelKey: 'common.reports.columns.contractor_performance.signedOffByName' },
    { key: 'totalProjectCost', label: 'Total Project Cost', format: 'currency', labelKey: 'common.reports.columns.contractor_performance.totalProjectCost' },
  ],
  inventory_usage: [
    { key: 'partNumber', label: 'Part #', labelKey: 'common.reports.columns.inventory_usage.partNumber' },
    { key: 'partName', label: 'Part', labelKey: 'common.reports.columns.inventory_usage.partName' },
    { key: 'movementType', label: 'Movement', labelKey: 'common.reports.columns.inventory_usage.movementType' },
    { key: 'quantityChange', label: 'Qty Change', format: 'number', labelKey: 'common.reports.columns.inventory_usage.quantityChange' },
    { key: 'quantityAfter', label: 'Qty After', format: 'number', labelKey: 'common.reports.columns.inventory_usage.quantityAfter' },
    { key: 'totalCostImpact', label: 'Cost Impact', format: 'currency', labelKey: 'common.reports.columns.inventory_usage.totalCostImpact' },
    { key: 'workOrderNumber', label: 'Linked WO', labelKey: 'common.reports.columns.inventory_usage.workOrderNumber' },
    // Whether this issue was handed out as a returnable loan, and — for
    // returnable issues — whether it's actually come back yet.
    { key: 'isReturnable', label: 'Returnable', format: 'bool', labelKey: 'common.reports.columns.inventory_usage.isReturnable' },
    { key: 'returnStatus', label: 'Return Status', labelKey: 'common.reports.columns.inventory_usage.returnStatus' },
    { key: 'performedByName', label: 'By', labelKey: 'common.reports.columns.inventory_usage.performedByName' },
    { key: 'performedAt', label: 'Date', format: 'date', labelKey: 'common.reports.columns.inventory_usage.performedAt' },
  ],
  low_stock_alert: [
    { key: 'name', label: 'Part Name', labelKey: 'common.reports.columns.low_stock_alert.name' },
    { key: 'lowStockAlertDate', label: 'Date of Received Low Stock Alert', format: 'date', labelKey: 'common.reports.columns.low_stock_alert.lowStockAlertDate' },
    { key: 'poStatus', label: 'Status', labelKey: 'common.reports.columns.low_stock_alert.poStatus' },
    { key: 'refilledDate', label: 'Refilled Date', format: 'date', labelKey: 'common.reports.columns.low_stock_alert.refilledDate' },
  ],
  // Exact column set/order requested: Part Number, Part Name, Location,
  // Category, Criticality, Status, Min Stock Level, Available Stock, Unit
  // Cost, Total Cost. Brand/Max Stock Level/Unit/Supplier/Lead Time exist on
  // InventoryPart but are intentionally dropped from this report.
  inventory_listing: [
    { key: 'partNumber', label: 'Part Number', labelKey: 'common.reports.columns.inventory_listing.partNumber' },
    { key: 'name', label: 'Part Name', labelKey: 'common.reports.columns.inventory_listing.name' },
    { key: 'storeLocation', label: 'Location', labelKey: 'common.reports.columns.inventory_listing.storeLocation' },
    { key: 'category', label: 'Category', labelKey: 'common.reports.columns.inventory_listing.category' },
    { key: 'criticality', label: 'Criticality', labelKey: 'common.reports.columns.inventory_listing.criticality' },
    { key: 'status', label: 'Status', labelKey: 'common.reports.columns.inventory_listing.status' },
    { key: 'minStockLevel', label: 'Min Stock Level', format: 'number', labelKey: 'common.reports.columns.inventory_listing.minStockLevel' },
    { key: 'availableStock', label: 'Available Stock', format: 'number', labelKey: 'common.reports.columns.inventory_listing.availableStock' },
    { key: 'unitCost', label: 'Unit Cost', format: 'currency', labelKey: 'common.reports.columns.inventory_listing.unitCost' },
    // Total value of stock currently held (unitCost x currentStock — the
    // standard inventory-valuation figure), computed in fetchReportRows since
    // it isn't stored on the document. Uses currentStock rather than
    // availableStock so it values everything physically on the shelf,
    // including stock reserved against open work orders/POs, consistent with
    // how "Total Cost" is used as a valuation figure elsewhere in this report
    // set (not a per-transaction cost like Maintenance Cost/PO History).
    { key: 'totalCost', label: 'Total Cost', format: 'currency', labelKey: 'common.reports.columns.inventory_listing.totalCost' },
  ],
  pm_compliance: [
    { key: 'scheduleName', label: 'Schedule', labelKey: 'common.reports.columns.pm_compliance.scheduleName' },
    { key: 'machineName', label: 'Machine', labelKey: 'common.reports.columns.pm_compliance.machineName' },
    { key: 'dueDate', label: 'Due', format: 'date', labelKey: 'common.reports.columns.pm_compliance.dueDate' },
    { key: 'completedDate', label: 'Completed', format: 'date', labelKey: 'common.reports.columns.pm_compliance.completedDate' },
    { key: 'status', label: 'Status', labelKey: 'common.reports.columns.pm_compliance.status' },
    { key: 'daysOverdue', label: 'Days Overdue', format: 'number', labelKey: 'common.reports.columns.pm_compliance.daysOverdue' },
    { key: 'technicianNames', label: 'Technicians', format: 'list', labelKey: 'common.reports.columns.pm_compliance.technicianNames' },
  ],
  machine_health_score: [
    { key: 'machineName', label: 'Machine', labelKey: 'common.reports.columns.machine_health_score.machineName' },
    { key: 'machineIdCode', label: 'Asset Code', labelKey: 'common.reports.columns.machine_health_score.machineIdCode' },
    { key: 'department', label: 'Department', labelKey: 'common.reports.columns.machine_health_score.department' },
    { key: 'currentStatus', label: 'Status', labelKey: 'common.reports.columns.machine_health_score.currentStatus' },
    { key: 'healthScore', label: 'Health Score', format: 'number', labelKey: 'common.reports.columns.machine_health_score.healthScore' },
    { key: 'watchFlagLevel', label: 'Watch Level', labelKey: 'common.reports.columns.machine_health_score.watchFlagLevel' },
    { key: 'mtbfDays', label: 'MTBF (days)', format: 'number', labelKey: 'common.reports.columns.machine_health_score.mtbfDays' },
    { key: 'mttrHours', label: 'MTTR (hours)', format: 'number', labelKey: 'common.reports.columns.machine_health_score.mttrHours' },
    { key: 'openBreakdownCount', label: 'Open Breakdowns', format: 'number', labelKey: 'common.reports.columns.machine_health_score.openBreakdownCount' },
    { key: 'openWoCount', label: 'Open WOs', format: 'number', labelKey: 'common.reports.columns.machine_health_score.openWoCount' },
    { key: 'maintenanceCostMTD', label: 'Cost MTD', format: 'currency', labelKey: 'common.reports.columns.machine_health_score.maintenanceCostMTD' },
    { key: 'lastServiceDate', label: 'Last Service', format: 'date', labelKey: 'common.reports.columns.machine_health_score.lastServiceDate' },
    { key: 'nextPmDue', label: 'Next PM', format: 'date', labelKey: 'common.reports.columns.machine_health_score.nextPmDue' },
  ],
  shift_handover_summary: [
    { key: 'shiftName', label: 'Shift Name', labelKey: 'common.reports.columns.shift_handover_summary.shiftName' },
    // personName/personRole are normalised across handovers and shift
    // sessions in fetchReportRows so both sources render the same columns
    // the Shift Handovers tab shows.
    { key: 'personName', label: 'Person', labelKey: 'common.reports.columns.shift_handover_summary.personName' },
    { key: 'personRole', label: 'Role', labelKey: 'common.reports.columns.shift_handover_summary.personRole' },
    { key: 'department', label: 'Department', labelKey: 'common.reports.columns.shift_handover_summary.department' },
    { key: 'shiftActualStart', label: 'Shift Started', format: 'datetime', labelKey: 'common.reports.columns.shift_handover_summary.shiftActualStart' },
    { key: 'lateByMinutes', label: 'Late By (min)', format: 'number', labelKey: 'common.reports.columns.shift_handover_summary.lateByMinutes' },
    { key: 'shiftActualEnd', label: 'Shift Ended', format: 'datetime', labelKey: 'common.reports.columns.shift_handover_summary.shiftActualEnd' },
    { key: 'otMinutes', label: 'OT (min)', format: 'number', labelKey: 'common.reports.columns.shift_handover_summary.otMinutes' },
    { key: 'breakdownsOpened', label: 'Breakdowns during Shift', format: 'number', labelKey: 'common.reports.columns.shift_handover_summary.breakdownsOpened' },
    { key: 'wosOpened', label: 'WOs during Shift', format: 'number', labelKey: 'common.reports.columns.shift_handover_summary.wosOpened' },
    { key: 'watchFlagsCount', label: 'Watch Flags', format: 'number', labelKey: 'common.reports.columns.shift_handover_summary.watchFlagsCount' },
  ],
  training_compliance: [
    { key: 'name', label: 'Name', labelKey: 'common.reports.columns.training_compliance.name' },
    { key: 'role', label: 'Role', labelKey: 'common.reports.columns.training_compliance.role' },
    { key: 'trainingsAssigned', label: 'No. of Trainings Assigned', format: 'number', labelKey: 'common.reports.columns.training_compliance.trainingsAssigned' },
    { key: 'trainingsCompleted', label: 'No. of Trainings Completed', format: 'number', labelKey: 'common.reports.columns.training_compliance.trainingsCompleted' },
    { key: 'totalMarks', label: 'Total Marks', format: 'number', labelKey: 'common.reports.columns.training_compliance.totalMarks' },
  ],
  machine_history: [
    { key: 'machineName', label: 'Machine Name', labelKey: 'common.reports.columns.machine_history.machineName' },
    { key: 'machineType', label: 'Type', labelKey: 'common.reports.columns.machine_history.machineType' },
    { key: 'purchaseDate', label: 'Purchased Date', format: 'date', labelKey: 'common.reports.columns.machine_history.purchaseDate' },
    { key: 'installationDate', label: 'Installed Date', format: 'date', labelKey: 'common.reports.columns.machine_history.installationDate' },
    { key: 'department', label: 'Department', labelKey: 'common.reports.columns.machine_history.department' },
    { key: 'location', label: 'Location', labelKey: 'common.reports.columns.machine_history.location' },
    { key: 'lastServiceDate', label: 'Last Service Date', format: 'date', labelKey: 'common.reports.columns.machine_history.lastServiceDate' },
    { key: 'lastServiceType', label: 'Last Service Type', labelKey: 'common.reports.columns.machine_history.lastServiceType' },
    { key: 'nextPmDue', label: 'Next PM Date', format: 'date', labelKey: 'common.reports.columns.machine_history.nextPmDue' },
  ],
  executive_monthly: [
    { key: 'metric', label: 'Metric', labelKey: 'common.reports.columns.executive_monthly.metric' },
    { key: 'value', label: 'Value', labelKey: 'common.reports.columns.executive_monthly.value' },
  ],
  audit_trail: [
    { key: 'date', label: 'Date', format: 'date', labelKey: 'common.reports.columns.audit_trail.date' },
    { key: 'categoryLabel', label: 'Category', labelKey: 'common.reports.columns.audit_trail.categoryLabel' },
    { key: 'scopeDetails', label: 'Scope Details', labelKey: 'common.reports.columns.audit_trail.scopeDetails' },
    { key: 'doneBy', label: 'Done By', labelKey: 'common.reports.columns.audit_trail.doneBy' },
    { key: 'participants', label: 'Participants', format: 'list', labelKey: 'common.reports.columns.audit_trail.participants' },
    { key: 'marks', label: 'Marks', format: 'number', labelKey: 'common.reports.columns.audit_trail.marks' },
  ],
  po_history: [
    { key: 'poNumber', label: 'PO Code', labelKey: 'common.reports.columns.po_history.poNumber' },
    { key: 'supplierName', label: 'Supplier', labelKey: 'common.reports.columns.po_history.supplierName' },
    { key: 'itemName', label: 'Item', labelKey: 'common.reports.columns.po_history.itemName' },
    { key: 'quantity', label: 'Quantity', format: 'number', labelKey: 'common.reports.columns.po_history.quantity' },
    // Final invoice-confirmed unit price — most recent invoiceRevisions entry
    // for this item, falling back to the PO item's own unitCost.
    { key: 'unitPrice', label: 'Unit Price', format: 'currency', labelKey: 'common.reports.columns.po_history.unitPrice' },
    { key: 'lineTotal', label: 'Total', format: 'currency', labelKey: 'common.reports.columns.po_history.lineTotal' },
    { key: 'status', label: 'Status', labelKey: 'common.reports.columns.po_history.status' },
    { key: 'raisedByName', label: 'Raised By', labelKey: 'common.reports.columns.po_history.raisedByName' },
    { key: 'raisedAt', label: 'Date', format: 'date', labelKey: 'common.reports.columns.po_history.raisedAt' },
    { key: 'receivedAt', label: 'Received Date', format: 'date', labelKey: 'common.reports.columns.po_history.receivedAt' },
  ],
};

/**
 * Returns the columns to use for a report. If no curated definition exists,
 * derives columns from the first row's own fields. Pass `t` to translate the
 * curated labels; without it, the columns keep their English fallback text
 * (safe for callers that don't have `t` on hand).
 */
export function resolveColumns(
  reportType: ReportType,
  rows: Record<string, unknown>[],
  t?: TFunction,
): ReportColumn[] {
  const defined = REPORT_COLUMNS[reportType];
  if (defined && defined.length > 0) {
    // Only keep columns that at least one row actually has data for.
    const present = defined.filter((col) => rows.some((r) => r[col.key] != null && r[col.key] !== ''));
    const chosen = present.length > 0 ? present : defined;
    return chosen.map((col) => ({ ...col, label: getColumnLabel(col, t) }));
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
export function formatCellForExcel(value: unknown, format?: ColumnFormat, t?: TFunction): string | number | Date {
  if (format === 'date' || format === 'datetime') {
    const d = toDate(value);
    if (d) return d;
  }
  return formatCell(value, format, t);
}

/** Maps rows into label-keyed objects for spreadsheet export. */
export function mapRowsToColumns(
  columns: ReportColumn[],
  rows: Record<string, unknown>[],
  t?: TFunction,
): Record<string, string | number | Date>[] {
  return rows.map((row) => {
    const out: Record<string, string | number | Date> = {};
    columns.forEach((col) => {
      out[col.label] = formatCellForExcel(row[col.key], col.format, t);
    });
    return out;
  });
}
