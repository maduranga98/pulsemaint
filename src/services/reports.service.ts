import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
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
import { computeMonthlyAnalytics, computeMachineHealth } from './analyticsAggregation';
import { fetchTeamPerformanceByRole } from './teamPerformance.service';
import { REPORT_DEFINITIONS } from '../utils/reports/reportDefinitions';
import { logAuditEvent } from '../utils/reports/auditLogger';
import type {
  AuditLog,
  ExportFormat,
  ReportConfig,
  ReportHistory,
  ReportHistoryFilters,
  ReportSchedule,
  ReportScheduleFrequency,
  ReportType,
} from '../types/reports.types';

const toDate = (value: unknown): Date => {
  if (value && typeof (value as Timestamp).toDate === 'function') return (value as Timestamp).toDate();
  if (value instanceof Date) return value;
  return new Date();
};

// Turns a snake_case enum value (e.g. 'wear_and_tear') into a readable label
// ('Wear And Tear') for display columns.
const prettifyEnum = (value: unknown): string =>
  String(value ?? '')
    .replace(/[_-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (m) => m.toUpperCase());

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

  // Team Performance (ReportType key: technician_performance) is a computed
  // per-role rollup of Evaluations, Audits, Training, and Quick Assessment —
  // not a raw workOrders dump, which only ever showed technician workload,
  // never evaluation/training/assessment data (PMGR-016/017).
  if (reportType === 'technician_performance') {
    return (await fetchTeamPerformanceByRole(companyId)) as unknown as Record<string, unknown>[];
  }

  // Maintenance Cost is a computed cost breakdown (labor hours + parts
  // consumed + contractor/project spend), not a raw dump of workOrders /
  // stockMovements / contractorJobs — those three collections don't share a
  // row shape, so reading them as one flat table produced garbage columns.
  if (reportType === 'maintenance_cost') {
    const [woSnap, contractorSnap] = await Promise.all([
      getDocs(query(collection(db, 'workOrders'), where('companyId', '==', companyId), limit(1000))),
      getDocs(query(collection(db, 'contractorJobs'), where('companyId', '==', companyId), limit(1000))),
    ]);

    const woCost = (w: Record<string, unknown>) => {
      const partsCost = Array.isArray(w.partsUsed)
        ? (w.partsUsed as Record<string, unknown>[]).reduce((s, p) => s + Number(p.totalCost ?? 0), 0)
        : 0;
      const laborCost = Array.isArray(w.technicianWorkLogs)
        ? (w.technicianWorkLogs as Record<string, unknown>[]).reduce((s, l) => s + Number(l.laborCost ?? 0), 0)
        : 0;
      return { partsCost, laborCost };
    };

    const costRows: Record<string, unknown>[] = [];
    woSnap.docs.forEach((item) => {
      const w = item.data();
      const { partsCost, laborCost } = woCost(w);
      if (partsCost === 0 && laborCost === 0) return;
      costRows.push({
        id: item.id,
        source: 'Work Order',
        reference: w.woNumber ?? item.id,
        machineName: w.machineName ?? '',
        machineDepartment: w.machineDepartment ?? w.department ?? '',
        laborCost,
        partsCost,
        contractorCost: 0,
        totalCost: laborCost + partsCost,
        createdAt: w.actualEndTime ?? w.createdAt ?? null,
      });
    });
    contractorSnap.docs.forEach((item) => {
      const c = item.data();
      const contractorCost = Number(c.systemInvoiceAmount ?? c.contractorInvoiceAmount ?? 0);
      const partsCost = Number(c.totalPartsCost ?? 0);
      if (contractorCost === 0 && partsCost === 0) return;
      costRows.push({
        id: item.id,
        source: 'Contractor Job',
        reference: c.workOrderNumber ?? item.id,
        machineName: c.machineName ?? '',
        machineDepartment: '',
        laborCost: 0,
        partsCost,
        contractorCost,
        totalCost: contractorCost + partsCost,
        createdAt: c.workCompletedAt ?? c.createdAt ?? null,
      });
    });

    return costRows.filter((row) => {
      const raw = row.createdAt as { toDate?: () => Date } | null;
      const d = raw && typeof raw.toDate === 'function' ? raw.toDate().toISOString().slice(0, 10) : null;
      if (!d) return true;
      return d >= config.dateFrom && d <= config.dateTo;
    });
  }

  // Maps each report to the Firestore collection(s) it reads from. These must
  // match the actual collection names used elsewhere in the app.
  const sourceMap: Record<ReportType, string[]> = {
    breakdown_summary: ['breakdown_tickets'],
    work_order_detail: ['workOrders'],
    // Machine History lists the machine's own work orders (with dates/types),
    // filtered to the chosen machine below.
    machine_history: ['workOrders'],
    machine_health_score: ['machine_health'],
    maintenance_cost: ['workOrders', 'stockMovements', 'contractorJobs'],
    // technician_performance (display name: "Team Performance Report") is a
    // computed branch below — role aggregation, not a raw collection.
    technician_performance: [],
    contractor_performance: ['contractorJobs'],
    inventory_usage: ['stockMovements'],
    parts_consumption: ['stockMovements'],
    low_stock_alert: ['inventoryParts'],
    inventory_listing: ['inventoryParts'],
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

  // Registry/snapshot collections describe current state (machines, parts,
  // health scores) — filtering them by createdAt against the report date range
  // hid every entity registered before the range and produced empty reports.
  // Only event-style rows participate in date filtering.
  const snapshotSources = new Set(['machines', 'machine_health', 'inventoryParts', 'analytics_monthly']);

  const rows: { source: string; row: Record<string, unknown> }[] = [];
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
          snap.docs.forEach((item) => rows.push({ source, row: { id: item.id, ...item.data() } }));
        } catch {
          /* skip unreadable sites */
        }
      }
      continue;
    }
    let docs: { id: string; data: () => Record<string, unknown> }[] = [];
    const bySite = async () => {
      const out: { id: string; data: () => Record<string, unknown> }[] = [];
      for (let i = 0; i < siteIds.length; i += 10) {
        const chunk = siteIds.slice(i, i + 10);
        const snap = await getDocs(query(collection(db, source), where('siteId', 'in', chunk), limit(1000)));
        snap.docs.forEach((d) => out.push(d));
      }
      return out;
    };
    try {
      const snap = await getDocs(query(collection(db, source), where('companyId', '==', companyId), limit(1000)));
      docs = snap.docs;
      // Some collections (e.g. workOrders / breakdown_tickets) are scoped by
      // siteId, and older documents may lack a companyId field — so a
      // successful-but-empty companyId query still needs a siteId fallback,
      // not just a thrown-error one, or the report shows "no data".
      if (docs.length === 0) {
        try {
          docs = await bySite();
        } catch {
          /* siteId fallback not permitted — leave empty */
        }
      }
    } catch (err) {
      // Site-restricted roles are denied companyId-wide list queries on some
      // collections (e.g. workOrders). Retry scoped by the user's sites so
      // the report still returns their data instead of failing outright.
      try {
        docs = await bySite();
      } catch {
        sourceErrors.push(`${source}: ${err instanceof Error ? err.message : 'query failed'}`);
        continue;
      }
    }
    // machine_health is a pre-aggregated collection normally populated by a
    // backend job that doesn't exist yet, so it's always empty — fall back to
    // the same on-the-fly computation the dashboard's machine health map uses
    // so the report isn't permanently blank.
    if (source === 'machine_health' && docs.length === 0) {
      const computed = await computeMachineHealth(companyId);
      computed.forEach((entry) => rows.push({ source, row: { id: entry.machineId, ...entry } }));
      continue;
    }

    docs.forEach((item) => {
      const data = item.data();
      if (reportType === 'low_stock_alert') {
        const current = Number(data.currentStock ?? data.currentQty ?? data.stockQuantity ?? 0);
        const min = Number(data.minStockLevel ?? data.reorderLevel ?? 0);
        if (current > min) return;
      }
      // safety_near_miss reads the same shift_handovers collection as
      // shift_handover_summary — without this filter every shift (not just
      // ones with a recorded incident) shows up, which reads as noise, not
      // a near-miss report.
      if (reportType === 'safety_near_miss' && data.safetyIncidentOccurred !== true) return;
      // shift_handovers keeps its counters under a nested `stats` object;
      // flatten them to top-level keys so report columns (which only read
      // row[col.key], not dot-paths) can reference wosOpened, etc. directly.
      const stats = (data.stats as Record<string, unknown> | undefined) ?? {};
      const row: Record<string, unknown> = { id: item.id, ...data, ...stats };

      // Breakdown Summary: expose a single "RCA Reason" cell — the free-text
      // root-cause description when present, otherwise the readable enum.
      if (reportType === 'breakdown_summary') {
        row.rcaReason = data.rootCauseDescription
          ? String(data.rootCauseDescription)
          : data.rootCause
            ? prettifyEnum(data.rootCause)
            : '';
      }

      // Work Order Detail: roll every person who participated in the work
      // (assigned internal technicians + any contractor technicians, plus the
      // contractor company itself for contractor WOs) into one list column;
      // sign-off and creator details come from their own fields.
      if (reportType === 'work_order_detail') {
        const techNames = Array.isArray(data.assignedTechnicianNames) ? (data.assignedTechnicianNames as unknown[]) : [];
        const contractorNames = Array.isArray(data.contractorTechnicianNames) ? (data.contractorTechnicianNames as unknown[]) : [];
        const contractorCompany = data.contractorCompanyName ? [data.contractorCompanyName as unknown] : [];
        row.participants = [...techNames, ...contractorNames, ...contractorCompany].map((n) => String(n)).filter(Boolean);
      }

      rows.push({ source, row });
    });
  }

  // Surface the failure instead of silently rendering "0 records" when every
  // source was unreadable — the user needs to know it's a permissions issue.
  if (rows.length === 0 && sourceErrors.length > 0) {
    throw new Error(`Could not read report data (${sourceErrors.join('; ')})`);
  }

  const dateFiltered = rows
    .filter(({ source, row }) => {
      if (snapshotSources.has(source)) return true;
      const rawDate = row.createdAt ?? row.timestamp ?? row.date ?? row.generatedAt ?? row.reportedAt;
      const rowDate = rawDate && typeof (rawDate as Timestamp).toDate === 'function'
        ? (rawDate as Timestamp).toDate().toISOString().slice(0, 10)
        : String(rawDate ?? '');
      if (rowDate && /^\d{4}-\d{2}-\d{2}/.test(rowDate)) {
        return rowDate >= config.dateFrom && rowDate <= config.dateTo;
      }
      return true;
    })
    .map(({ row }) => row);

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

  // Only the health-score report is keyed by machine doc-id; machine_history
  // now reads work orders, which reference the machine via machineId.
  const isMachineReport = reportType === 'machine_health_score';

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

// Fields surfaced in the Machine History report's profile block. Kept as a
// simple label/value list so the PDF can render it without knowing the machine
// schema.
export interface MachineProfileField {
  label: string;
  value: string;
}

// Reads the selected machine's registry document and returns a flat set of
// profile fields for the Machine History report header. Returns null when the
// machine can't be read (e.g. deleted, or the user lacks access).
export async function fetchMachineProfile(machineId: string): Promise<MachineProfileField[] | null> {
  if (!machineId) return null;
  let data: Record<string, unknown> | undefined;
  try {
    const snap = await getDoc(doc(db, 'machines', machineId));
    if (!snap.exists()) return null;
    data = snap.data();
  } catch {
    return null;
  }
  if (!data) return null;

  const asDate = (value: unknown): string => {
    if (value && typeof (value as Timestamp).toDate === 'function') return (value as Timestamp).toDate().toLocaleDateString();
    return value ? String(value) : '';
  };
  const text = (value: unknown): string => (value == null || value === '' ? '' : String(value));

  const location = [data.department, data.floor, data.bay, data.station]
    .filter((part) => part != null && part !== '')
    .map((part) => String(part))
    .join(' · ');

  return [
    { label: 'Machine', value: text(data.name) },
    { label: 'Manufacturer', value: text(data.manufacturer) },
    { label: 'Model', value: text(data.model) },
    { label: 'Serial Number', value: text(data.serialNumber) },
    { label: 'Type', value: prettifyEnum(data.type) || '' },
    { label: 'Department', value: text(data.department) },
    { label: 'Location', value: location || '' },
    { label: 'Status', value: prettifyEnum(data.status) || '' },
    { label: 'Criticality', value: text(data.criticality) },
    { label: 'Health Score', value: data.healthScore != null ? String(data.healthScore) : '' },
    { label: 'Installation Date', value: asDate(data.installationDate) },
    { label: 'Last Service', value: asDate(data.lastServiceDate) },
    { label: 'Next PM Due', value: asDate(data.nextPmDue) },
  ];
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

  // audit_logs otherwise never gets written to — the Audit Trail report was
  // permanently empty because nothing populated its source collection.
  try {
    await logAuditEvent({
      companyId: input.companyId,
      userId: input.generatedBy,
      userName: input.generatedByName,
      userRole: useAuthStore.getState().userProfile?.role ?? '',
      action: 'EXPORT',
      entityType: 'report',
      entityId: ref.id,
      entityName: definition.name,
    });
  } catch {
    /* non-blocking */
  }

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

// ---------------------------------------------------------------------------
// Report scheduling — recurring export delivery (PMGR-009)
// ---------------------------------------------------------------------------

const toReportSchedule = (id: string, data: Record<string, unknown>): ReportSchedule => ({
  id,
  companyId: String(data.companyId ?? ''),
  reportType: data.reportType as ReportType,
  reportName: String(data.reportName ?? ''),
  frequency: data.frequency as ReportScheduleFrequency,
  dayOfWeek: (data.dayOfWeek as number | null) ?? null,
  dayOfMonth: (data.dayOfMonth as number | null) ?? null,
  recipients: Array.isArray(data.recipients) ? (data.recipients as string[]) : [],
  filters: (data.filters as Record<string, unknown>) ?? {},
  active: data.active !== false,
  createdBy: String(data.createdBy ?? ''),
  createdByName: String(data.createdByName ?? ''),
  createdAt: toDate(data.createdAt),
  lastRunAt: data.lastRunAt ? toDate(data.lastRunAt) : null,
  nextRunAt: data.nextRunAt ? toDate(data.nextRunAt) : null,
});

function computeNextRunAt(
  frequency: ReportScheduleFrequency,
  dayOfWeek: number | null,
  dayOfMonth: number | null,
  from: Date = new Date(),
): Date {
  const next = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate(), 4, 0, 0));
  if (next <= from) next.setUTCDate(next.getUTCDate() + 1);

  if (frequency === 'daily') return next;

  if (frequency === 'weekly') {
    const target = dayOfWeek ?? 1;
    while (next.getUTCDay() !== target) next.setUTCDate(next.getUTCDate() + 1);
    return next;
  }

  // monthly
  const target = Math.min(Math.max(dayOfMonth ?? 1, 1), 28);
  next.setUTCDate(1);
  if (next <= from) next.setUTCMonth(next.getUTCMonth() + 1);
  next.setUTCDate(target);
  return next;
}

export async function createReportSchedule(input: {
  companyId: string;
  reportType: ReportType;
  frequency: ReportScheduleFrequency;
  dayOfWeek?: number | null;
  dayOfMonth?: number | null;
  recipients: string[];
  createdBy: string;
  createdByName: string;
  config: ReportConfig;
}): Promise<string> {
  const definition = REPORT_DEFINITIONS[input.reportType];
  const dayOfWeek = input.dayOfWeek ?? null;
  const dayOfMonth = input.dayOfMonth ?? null;
  const ref = await addDoc(collection(db, 'report_schedules'), {
    companyId: input.companyId,
    reportType: input.reportType,
    reportName: definition.name,
    frequency: input.frequency,
    dayOfWeek,
    dayOfMonth,
    recipients: input.recipients,
    filters: filtersFromConfig(input.config),
    active: true,
    createdBy: input.createdBy,
    createdByName: input.createdByName,
    createdAt: serverTimestamp(),
    lastRunAt: null,
    nextRunAt: computeNextRunAt(input.frequency, dayOfWeek, dayOfMonth),
  });
  return ref.id;
}

export async function fetchReportSchedules(
  companyId: string,
  reportType?: ReportType,
): Promise<ReportSchedule[]> {
  const snap = await getDocs(
    query(collection(db, 'report_schedules'), where('companyId', '==', companyId)),
  );
  return snap.docs
    .map((item) => toReportSchedule(item.id, item.data()))
    .filter((s) => !reportType || s.reportType === reportType)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export async function setReportScheduleActive(scheduleId: string, active: boolean): Promise<void> {
  await updateDoc(doc(db, 'report_schedules', scheduleId), { active });
}

export async function deleteReportSchedule(scheduleId: string): Promise<void> {
  await deleteDoc(doc(db, 'report_schedules', scheduleId));
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
