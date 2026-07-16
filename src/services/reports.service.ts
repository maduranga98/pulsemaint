import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type Timestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuthStore } from '../store/authStore';
import { computeMonthlyAnalytics } from './analyticsAggregation';
import { REPORT_DEFINITIONS } from '../utils/reports/reportDefinitions';
import type {
  AuditLog,
  ExportFormat,
  ReportConfig,
  ReportHistory,
  ReportHistoryFilters,
  ReportType,
} from '../types/reports.types';

const toDate = (value: unknown): Date => {
  if (value && typeof (value as Timestamp).toDate === 'function') return (value as Timestamp).toDate();
  if (value instanceof Date) return value;
  return new Date();
};

const toReportHistory = (id: string, data: Record<string, unknown>): ReportHistory => ({
  id,
  companyId: String(data.companyId ?? ''),
  reportType: data.reportType as ReportType,
  reportName: String(data.reportName ?? ''),
  generatedBy: String(data.generatedBy ?? ''),
  generatedByName: String(data.generatedByName ?? ''),
  generatedAt: toDate(data.generatedAt),
  format: data.format as ExportFormat,
  dateRangeFrom: String(data.dateRangeFrom ?? ''),
  dateRangeTo: String(data.dateRangeTo ?? ''),
  filters: (data.filters as Record<string, unknown>) ?? {},
  storageUrl: (data.storageUrl as string | null) ?? null,
  downloadUrl: (data.downloadUrl as string | null) ?? null,
  googleSheetsUrl: (data.googleSheetsUrl as string | null) ?? null,
  fileSizeBytes: (data.fileSizeBytes as number | null) ?? null,
  generationTimeMs: Number(data.generationTimeMs ?? 0),
  status: (data.status as ReportHistory['status']) ?? 'ready',
  errorMessage: (data.errorMessage as string | null) ?? null,
  pageCount: (data.pageCount as number | null) ?? null,
  rowCount: (data.rowCount as number | null) ?? null,
  expiresAt: toDate(data.expiresAt),
});

export function filtersFromConfig(config: ReportConfig): Record<string, unknown> {
  return {
    machines: config.machines,
    departments: config.departments,
    severities: config.severities,
    woTypes: config.woTypes,
    breakdownTypes: config.breakdownTypes,
    technicians: config.technicians,
    contractors: config.contractors,
    partCategories: config.partCategories,
    shifts: config.shifts,
    supervisors: config.supervisors,
    priorities: config.priorities,
    invoiceStatuses: config.invoiceStatuses,
    trainingStatuses: config.trainingStatuses,
    slaStatuses: config.slaStatuses,
  };
}

export async function fetchReportRows(
  reportType: ReportType,
  companyId: string,
  config: ReportConfig,
): Promise<Record<string, unknown>[]> {
  // Executive summary is computed analytics, not a raw collection — build it
  // from the aggregation pipeline for the latest month in the range.
  if (reportType === 'executive_monthly') {
    const month = (config.dateTo || new Date().toISOString().slice(0, 10)).slice(0, 7);
    const m = await computeMonthlyAnalytics(companyId, month);
    const rows: Record<string, unknown>[] = [
      { metric: 'Month', value: m.month },
      { metric: 'Total Breakdowns', value: m.totalBreakdowns },
      { metric: 'Avg MTTR (hours)', value: m.avgMttrHours },
      { metric: 'Avg MTBF (days)', value: m.avgMtbfDays },
      { metric: 'SLA Compliance (%)', value: m.overallSlaCompliance },
      { metric: 'PM Compliance (%)', value: m.pmComplianceRate },
      { metric: 'Total Maintenance Cost', value: m.totalMaintenanceCost },
      { metric: 'Production Hours Lost', value: m.totalProductionHoursLost },
    ];
    m.topProblemMachines.slice(0, 5).forEach((mac, i) => {
      rows.push({
        metric: `Top Problem Machine #${i + 1}`,
        value: `${mac.machineName} — ${mac.breakdownCount} breakdowns, ${mac.downtimeHours.toFixed(1)}h down`,
      });
    });
    Object.entries(m.breakdownBySeverity).forEach(([sev, count]) => {
      rows.push({ metric: `Breakdowns — ${sev}`, value: count });
    });
    return rows;
  }

  // Maps each report to the Firestore collection(s) it reads from. These must
  // match the actual collection names used elsewhere in the app.
  const sourceMap: Record<ReportType, string[]> = {
    breakdown_summary: ['breakdown_tickets'],
    work_order_detail: ['workOrders'],
    machine_history: ['machines'],
    machine_health_score: ['machine_health'],
    maintenance_cost: ['workOrders', 'stockMovements', 'contractorJobs'],
    technician_performance: ['workOrders'],
    contractor_performance: ['contractorJobs'],
    contractor_invoice_comparison: ['contractorJobs'],
    inventory_usage: ['stockMovements'],
    parts_consumption: ['stockMovements'],
    low_stock_alert: ['inventoryParts'],
    pm_compliance: ['pm_history'],
    // 'training_records' never existed as a collection — training data lives
    // in trainingAssignments (see src/hooks/training/useComplianceData.ts).
    // The report silently returned zero rows before this fix.
    training_compliance: ['trainingAssignments'],
    sla_compliance: ['breakdown_tickets'],
    shift_handover_summary: ['shift_handovers'],
    downtime_analysis: ['breakdown_tickets'],
    executive_monthly: ['analytics_monthly'],
    safety_near_miss: ['shift_handovers'],
    audit_trail: ['audit_logs'],
  };

  const rows: Record<string, unknown>[] = [];
  const sourceErrors: string[] = [];
  const siteIds = [
    ...new Set([...(useAuthStore.getState().userProfile?.siteIds ?? []), companyId]),
  ].filter(Boolean);

  for (const source of sourceMap[reportType]) {
    // Machines are scoped by siteId, not companyId — querying them by
    // companyId returned nothing and produced empty machine exports.
    if (source === 'machines') {
      for (let i = 0; i < siteIds.length; i += 10) {
        const chunk = siteIds.slice(i, i + 10);
        try {
          const snap = await getDocs(query(collection(db, 'machines'), where('siteId', 'in', chunk)));
          snap.docs.forEach((item) => rows.push({ id: item.id, ...item.data() }));
        } catch {
          /* skip unreadable sites */
        }
      }
      continue;
    }
    let docs: { id: string; data: () => Record<string, unknown> }[] = [];
    try {
      const snap = await getDocs(query(collection(db, source), where('companyId', '==', companyId), limit(1000)));
      docs = snap.docs;
    } catch (err) {
      // Site-restricted roles are denied companyId-wide list queries on some
      // collections (e.g. workOrders). Retry scoped by the user's sites so
      // the report still returns their data instead of failing outright.
      try {
        for (let i = 0; i < siteIds.length; i += 10) {
          const chunk = siteIds.slice(i, i + 10);
          const snap = await getDocs(query(collection(db, source), where('siteId', 'in', chunk), limit(1000)));
          docs = docs.concat(snap.docs);
        }
      } catch {
        sourceErrors.push(`${source}: ${err instanceof Error ? err.message : 'query failed'}`);
        continue;
      }
    }
    docs.forEach((item) => {
      const data = item.data();
      if (reportType === 'low_stock_alert') {
        const current = Number(data.currentStock ?? data.currentQty ?? data.stockQuantity ?? 0);
        const min = Number(data.minStockLevel ?? data.reorderLevel ?? 0);
        if (current > min) return;
      }
      // shift_handovers keeps its counters under a nested `stats` object;
      // flatten them to top-level keys so report columns (which only read
      // row[col.key], not dot-paths) can reference wosOpened, etc. directly.
      const stats = (data.stats as Record<string, unknown> | undefined) ?? {};
      rows.push({ id: item.id, ...data, ...stats });
    });
  }

  // Surface the failure instead of silently rendering "0 records" when every
  // source was unreadable — the user needs to know it's a permissions issue.
  if (rows.length === 0 && sourceErrors.length > 0) {
    throw new Error(`Could not read report data (${sourceErrors.join('; ')})`);
  }

  const dateFiltered = rows.filter((row) => {
    const rawDate = row.createdAt ?? row.timestamp ?? row.date ?? row.generatedAt ?? row.reportedAt;
    const rowDate = rawDate && typeof (rawDate as Timestamp).toDate === 'function'
      ? (rawDate as Timestamp).toDate().toISOString().slice(0, 10)
      : String(rawDate ?? '');
    if (rowDate && /^\d{4}-\d{2}-\d{2}/.test(rowDate)) {
      return rowDate >= config.dateFrom && rowDate <= config.dateTo;
    }
    return true;
  });

  // Apply common multi-select filters where the row exposes a matching field.
  // Comparison is case-insensitive: the UI historically offered title-case
  // options ("Critical") while documents store lowercase values ("critical").
  const matchesList = (value: unknown, selected: string[]) =>
    selected.length === 0 ||
    (value != null &&
      selected.some((s) => s.toLowerCase() === String(value).toLowerCase()));

  const matchesAnyInList = (values: unknown, selected: string[]) =>
    selected.length === 0 ||
    (Array.isArray(values) && values.some((v) => selected.some((s) => s.toLowerCase() === String(v).toLowerCase())));

  const isMachineReport = reportType === 'machine_history' || reportType === 'machine_health_score';

  return dateFiltered.filter((row) => {
    // Machine rows themselves carry the machine ID as the doc ID; other rows
    // only participate in the machine filter when they reference a machine —
    // comparing unrelated doc IDs used to zero out every non-machine report.
    const machineRef = row.machineId ?? (isMachineReport ? row.id : undefined);
    if (machineRef !== undefined && !matchesList(machineRef, config.machines)) return false;
    if (!matchesList(row.department ?? row.machineDepartment, config.departments)) return false;
    if (!matchesList(row.severity, config.severities)) return false;
    if (!matchesList(row.woType, config.woTypes)) return false;
    if (!matchesList(row.type, config.breakdownTypes)) return false;
    if (!matchesList(row.contractorCompanyId ?? row.contractorId, config.contractors)) return false;
    if (!matchesList(row.priority, config.priorities)) return false;
    if (config.technicians.length > 0 && (row.assignedTechnicianIds !== undefined || row.traineeId !== undefined)) {
      const matchesTech = matchesAnyInList(row.assignedTechnicianIds, config.technicians) || matchesList(row.traineeId, config.technicians);
      if (!matchesTech) return false;
    }
    if (config.supervisors.length > 0 && (row.supervisorInChargeId !== undefined || row.outgoingSupervisorId !== undefined)) {
      const matchesSup = matchesList(row.supervisorInChargeId, config.supervisors)
        || matchesList(row.outgoingSupervisorId, config.supervisors)
        || matchesList(row.incomingSupervisorId, config.supervisors);
      if (!matchesSup) return false;
    }
    if (config.shifts.length > 0 && (row.shiftName !== undefined || row.shift !== undefined)) {
      if (!matchesList(row.shiftName ?? row.shift, config.shifts)) return false;
    }
    return true;
  });
}

export async function createReportHistory(input: {
  companyId: string;
  reportType: ReportType;
  generatedBy: string;
  generatedByName: string;
  format: ExportFormat;
  config: ReportConfig;
  rowCount?: number | null;
  googleSheetsUrl?: string | null;
  downloadUrl?: string | null;
}): Promise<string> {
  const definition = REPORT_DEFINITIONS[input.reportType];
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);
  const ref = await addDoc(collection(db, 'report_history'), {
    companyId: input.companyId,
    reportType: input.reportType,
    reportName: definition.name,
    generatedBy: input.generatedBy,
    generatedByName: input.generatedByName,
    generatedAt: serverTimestamp(),
    format: input.format,
    dateRangeFrom: input.config.dateFrom,
    dateRangeTo: input.config.dateTo,
    filters: filtersFromConfig(input.config),
    storageUrl: null,
    downloadUrl: input.downloadUrl ?? null,
    googleSheetsUrl: input.googleSheetsUrl ?? null,
    fileSizeBytes: null,
    generationTimeMs: 0,
    status: 'ready',
    errorMessage: null,
    pageCount: null,
    rowCount: input.rowCount ?? null,
    expiresAt,
  });
  return ref.id;
}

export async function fetchReportHistory(
  companyId: string,
  filters: ReportHistoryFilters,
): Promise<ReportHistory[]> {
  const constraints = [where('companyId', '==', companyId), orderBy('generatedAt', 'desc'), limit(100)];
  const snap = await getDocs(query(collection(db, 'report_history'), ...constraints));
  return snap.docs
    .map((item) => toReportHistory(item.id, item.data()))
    .filter((item) => filters.reportType === 'all' || item.reportType === filters.reportType)
    .filter((item) => filters.format === 'all' || item.format === filters.format)
    .filter((item) => !filters.generatedBy || item.generatedByName.toLowerCase().includes(filters.generatedBy.toLowerCase()))
    .filter((item) => !filters.dateFrom || item.dateRangeFrom >= filters.dateFrom)
    .filter((item) => !filters.dateTo || item.dateRangeTo <= filters.dateTo);
}

export async function deleteReportHistory(reportId: string): Promise<void> {
  await deleteDoc(doc(db, 'report_history', reportId));
}

export async function markReportHistoryFailed(reportId: string, errorMessage: string): Promise<void> {
  await updateDoc(doc(db, 'report_history', reportId), {
    status: 'failed',
    errorMessage,
  });
}

export async function fetchAuditLogs(companyId: string): Promise<AuditLog[]> {
  const snap = await getDocs(
    query(collection(db, 'audit_logs'), where('companyId', '==', companyId), orderBy('timestamp', 'desc'), limit(500)),
  );
  return snap.docs.map((item) => {
    const data = item.data();
    return {
      id: item.id,
      companyId: String(data.companyId ?? ''),
      timestamp: toDate(data.timestamp),
      userId: String(data.userId ?? ''),
      userName: String(data.userName ?? ''),
      userRole: String(data.userRole ?? ''),
      action: data.action,
      entityType: data.entityType,
      entityId: String(data.entityId ?? ''),
      entityName: String(data.entityName ?? ''),
      changes: data.changes ?? null,
      ipAddress: data.ipAddress ?? null,
      userAgent: data.userAgent ?? null,
      sessionId: data.sessionId ?? null,
    } as AuditLog;
  });
}
