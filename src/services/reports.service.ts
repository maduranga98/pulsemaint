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
import { fetchTeamPerformanceByUser } from './teamPerformance.service';
import { computeWoTotalCost, flattenPoLineItems, type PoHistoryInput } from '../lib/reportsCostUtils';
import { getCategoryLabel } from '../modules/audit/types/audit.types';
import { REPORT_DEFINITIONS } from '../utils/reports/reportDefinitions';
import { logAuditEvent } from '../utils/reports/auditLogger';
import type {
  AuditLog,
  ExportFormat,
  ReportConfig,
  ReportHistory,
  ReportHistoryFilters,
  ReportType,
} from '../types/reports.types';

/**
 * Minutes a shift session started late against its scheduled start time.
 * Mirrors calculateLateStartMinutes in handover.utils, working from the raw
 * Firestore values the report rows carry.
 */
function computeLateMinutes(actualStart: unknown, scheduledStart: unknown): number {
  const start =
    actualStart && typeof (actualStart as { toDate?: () => Date }).toDate === 'function'
      ? (actualStart as { toDate: () => Date }).toDate()
      : actualStart instanceof Date
        ? actualStart
        : null;
  const scheduled = typeof scheduledStart === 'string' ? scheduledStart : '';
  if (!start || !scheduled) return 0;
  const [hours, minutes] = scheduled.split(':').map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return 0;
  const due = new Date(start);
  due.setHours(hours, minutes, 0, 0);
  return Math.max(0, Math.round((start.getTime() - due.getTime()) / 60000));
}


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
  // Date range is deliberately NOT applied here (same treatment as
  // executive_monthly): this report is a "current state" rollup — each
  // person's *most recent* Evaluation/Audit score plus lifetime training/quiz
  // counts, not a list of dated events. Scoping it to a date window would
  // require re-deriving "most recent as of date X" and re-counting trainings/
  // quizzes within the window across 4 separate collections inside
  // fetchTeamPerformanceByUser — a real feature, not a bug fix, and out of
  // scope here. Documented rather than silently left broken, per the task.
  if (reportType === 'technician_performance') {
    return (await fetchTeamPerformanceByUser(companyId)) as unknown as Record<string, unknown>[];
  }

  // Maintenance Cost is a computed cost breakdown — one row per work order,
  // merging used-parts cost (+ labor) from workOrders with the contractor's
  // sign-off "total project cost" (see SignOffForm) keyed by workOrderId, so
  // a contractor WO shows a single, complete Total Cost figure instead of two
  // disconnected rows. NOTE: this used to `return` here, which meant the
  // shared machines/departments/woTypes/contractors filter block further down
  // this function never ran for this report — every filter silently produced
  // zero matches. Filters are now applied explicitly below before returning.
  if (reportType === 'maintenance_cost') {
    const [woSnap, contractorSnap] = await Promise.all([
      getDocs(query(collection(db, 'workOrders'), where('companyId', '==', companyId), limit(1000))),
      getDocs(query(collection(db, 'contractorJobs'), where('companyId', '==', companyId), limit(1000))),
    ]);

    // Contractor total project cost (parts auto-included + contractor's own
    // cost, captured at sign-off — see SignOffForm.tsx), keyed by workOrderId.
    const contractorCostByWoId = new Map<string, { cost: number; signedOffAt: unknown }>();
    contractorSnap.docs.forEach((item) => {
      const c = item.data();
      const woId = String(c.workOrderId ?? '');
      if (!woId) return;
      const cost = Number(c.totalProjectCost ?? c.systemInvoiceAmount ?? 0);
      contractorCostByWoId.set(woId, { cost, signedOffAt: c.signedOffAt ?? null });
    });

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
      const contractorEntry = contractorCostByWoId.get(item.id);
      const contractorCost = contractorEntry?.cost ?? 0;
      if (partsCost === 0 && laborCost === 0 && contractorCost === 0) return;
      const department = String(w.machineDepartment ?? w.department ?? '');
      costRows.push({
        id: item.id,
        source: 'Work Order',
        reference: w.woNumber ?? item.id,
        woTicket: w.woNumber ?? item.id,
        woType: w.woType ?? '',
        machineName: w.machineName ?? '',
        machineId: w.machineId ?? '',
        machineDepartment: department,
        department,
        contractorCompanyId: w.contractorCompanyId ?? w.contractorId ?? '',
        priority: w.priority ?? '',
        laborCost,
        partsCost,
        contractorCost,
        totalCost: computeWoTotalCost(partsCost, laborCost, contractorCost),
        signedOffDate: contractorEntry?.signedOffAt ?? w.supervisorSignOffAt ?? null,
        createdAt: w.actualEndTime ?? w.createdAt ?? null,
      });
    });

    const matchesList = (value: unknown, selected: string[]) =>
      selected.length === 0 ||
      (value != null && selected.some((s) => s.toLowerCase() === String(value).toLowerCase()));

    const filtered = costRows.filter((row) => {
      if (!matchesList(row.machineId, config.machines)) return false;
      if (!matchesList(row.department, config.departments)) return false;
      if (!matchesList(row.woType, config.woTypes)) return false;
      if (!matchesList(row.contractorCompanyId, config.contractors)) return false;
      if (!matchesList(row.priority, config.priorities)) return false;
      const raw = row.createdAt as { toDate?: () => Date } | null;
      const d = raw && typeof raw.toDate === 'function' ? raw.toDate().toISOString().slice(0, 10) : null;
      if (!d) return true;
      return d >= config.dateFrom && d <= config.dateTo;
    });

    return filtered;
  }

  // Contractor Performance is a per-contractor rollup of their contractor
  // jobs — Name, WOs Completed, Rating, Signed Off Date, Signed Off By, Total
  // Project Cost — not a per-job dump, since "WOs Completed"/"Rating" are
  // aggregates, not fields on a single job document.
  if (reportType === 'contractor_performance') {
    const snap = await getDocs(
      query(collection(db, 'contractorJobs'), where('companyId', '==', companyId), limit(1000)),
    );

    const byContractor = new Map<string, {
      name: string;
      wosCompleted: number;
      ratingTotal: number;
      ratingCount: number;
      totalProjectCost: number;
      lastSignedOffAt: unknown;
      lastSignedOffAtMs: number;
      lastSignedOffByName: string;
    }>();

    const asMs = (value: unknown): number => {
      if (value && typeof (value as { toDate?: () => Date }).toDate === 'function') {
        return (value as { toDate: () => Date }).toDate().getTime();
      }
      return 0;
    };

    const matchesList = (value: unknown, selected: string[]) =>
      selected.length === 0 ||
      (value != null && selected.some((s) => s.toLowerCase() === String(value).toLowerCase()));

    // Same bug class as maintenance_cost: this branch used to `return`
    // straight from the aggregation with no date-range or contractor-filter
    // applied at all, so both the date pickers and the Contractor multi-
    // select in the UI silently did nothing for this report. Filtered here,
    // per-job, before rolling up into the per-contractor summary — using
    // signedOffAt for the date range (a contractor job only has one
    // meaningful date: when it was signed off) and contractorId for the
    // Contractor filter.
    const filteredDocs = snap.docs.filter((item) => {
      const c = item.data();
      const contractorRef = c.contractorId ?? c.manualContractorName ?? c.contractorName;
      if (!matchesList(contractorRef, config.contractors)) return false;
      const signedOffMs = asMs(c.signedOffAt);
      if (signedOffMs === 0) return true;
      const isoDate = new Date(signedOffMs).toISOString().slice(0, 10);
      return isoDate >= config.dateFrom && isoDate <= config.dateTo;
    });

    filteredDocs.forEach((item) => {
      const c = item.data();
      const key = String(c.contractorId ?? c.manualContractorName ?? c.contractorName ?? item.id);
      const name = String(c.contractorName ?? c.manualContractorName ?? 'Unknown Contractor');
      const entry = byContractor.get(key) ?? {
        name,
        wosCompleted: 0,
        ratingTotal: 0,
        ratingCount: 0,
        totalProjectCost: 0,
        lastSignedOffAt: null,
        lastSignedOffAtMs: 0,
        lastSignedOffByName: '',
      };
      if (c.status === 'signed_off' || c.status === 'completed') entry.wosCompleted += 1;
      const rating = c.rating as Record<string, unknown> | undefined;
      if (rating?.overallScore != null) {
        entry.ratingTotal += Number(rating.overallScore);
        entry.ratingCount += 1;
      }
      entry.totalProjectCost += Number(c.totalProjectCost ?? c.systemInvoiceAmount ?? 0);
      const signedOffMs = asMs(c.signedOffAt);
      if (signedOffMs >= entry.lastSignedOffAtMs) {
        entry.lastSignedOffAtMs = signedOffMs;
        entry.lastSignedOffAt = c.signedOffAt ?? null;
        entry.lastSignedOffByName = String(c.signedOffByName ?? '');
      }
      byContractor.set(key, entry);
    });

    return Array.from(byContractor.values()).map((entry) => ({
      contractorName: entry.name,
      wosCompleted: entry.wosCompleted,
      rating: entry.ratingCount > 0 ? Number((entry.ratingTotal / entry.ratingCount).toFixed(2)) : null,
      signedOffDate: entry.lastSignedOffAt,
      signedOffByName: entry.lastSignedOffByName,
      totalProjectCost: entry.totalProjectCost,
    }));
  }

  // Training Compliance covers both the general trainingAssignments
  // collection (employee/machine training) and the trainee programme system
  // (traineeProgrammes) — one row per person, aggregating both sources.
  // Like technician_performance, this is a lifetime per-person rollup with no
  // natural per-row date, and its report definition offers no date/list
  // filters (availableFilters: []) — there is nothing to bypass here.
  if (reportType === 'training_compliance') {
    const [assignmentSnap, programmeSnap, usersSnap] = await Promise.all([
      getDocs(query(collection(db, 'trainingAssignments'), where('companyId', '==', companyId), limit(2000))),
      getDocs(query(collection(db, 'traineeProgrammes'), where('companyId', '==', companyId), limit(1000))),
      // The top-level `users` collection is only an auth-routing mapping doc
      // ({ uid, companyId, role, siteId }); role lookups need the real
      // per-company profile at companies/{companyId}/users (see
      // teamPerformance.service.ts for the same fix on the Name bug).
      getDocs(query(collection(db, `companies/${companyId}/users`), limit(1000))),
    ]);

    const roleByUserId = new Map<string, string>();
    usersSnap.docs.forEach((item) => {
      const u = item.data();
      roleByUserId.set(item.id, String(u.role ?? ''));
    });

    interface PersonAgg {
      name: string;
      role: string;
      assigned: number;
      completed: number;
      totalMarks: number;
    }
    const byPerson = new Map<string, PersonAgg>();
    const completedStatuses = new Set(['certified', 'quiz_passed', 'awaiting_practical']);

    assignmentSnap.docs.forEach((item) => {
      const a = item.data();
      const traineeId = String(a.traineeId ?? '');
      if (!traineeId) return;
      const entry = byPerson.get(traineeId) ?? {
        name: String(a.traineeName ?? 'Unknown'),
        role: roleByUserId.get(traineeId) ?? 'trainee',
        assigned: 0,
        completed: 0,
        totalMarks: 0,
      };
      entry.assigned += 1;
      if (completedStatuses.has(String(a.status))) entry.completed += 1;
      entry.totalMarks += Number(a.bestScore ?? a.latestScore ?? 0);
      byPerson.set(traineeId, entry);
    });

    // The trainee programme's own final mark (quiz + final assessment
    // aggregate) is tracked separately from module-level assignments — add
    // it on top so a trainee's Total Marks reflects both.
    programmeSnap.docs.forEach((item) => {
      const p = item.data();
      const traineeId = String(p.traineeId ?? '');
      if (!traineeId) return;
      const entry = byPerson.get(traineeId) ?? {
        name: String(p.traineeName ?? 'Unknown'),
        role: roleByUserId.get(traineeId) ?? 'trainee',
        assigned: 0,
        completed: 0,
        totalMarks: 0,
      };
      if (p.finalMark != null) entry.totalMarks += Number(p.finalMark);
      if (p.status === 'completed') entry.completed += 1;
      byPerson.set(traineeId, entry);
    });

    return Array.from(byPerson.values())
      .map((p) => ({
        name: p.name,
        role: p.role,
        trainingsAssigned: p.assigned,
        trainingsCompleted: p.completed,
        totalMarks: Math.round(p.totalMarks),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  // Downtime Analysis: computed from workOrders (createdAt → sign-off), not
  // breakdown_tickets — breakdown_tickets doesn't carry a sign-off timestamp,
  // so downtime (created → signed off) can't be computed from it. Only
  // work orders that have actually been signed off have a known downtime.
  if (reportType === 'downtime_analysis') {
    const woSnap = await getDocs(
      query(collection(db, 'workOrders'), where('companyId', '==', companyId), limit(1000)),
    );
    const rowsOut: Record<string, unknown>[] = [];
    woSnap.docs.forEach((item) => {
      const w = item.data();
      const createdAt = w.createdAt as Timestamp | undefined;
      const signedOffAt = w.supervisorSignOffAt as Timestamp | undefined;
      if (!createdAt || typeof createdAt.toDate !== 'function') return;
      if (!signedOffAt || typeof signedOffAt.toDate !== 'function') return;
      const createdDate = createdAt.toDate();
      const downtimeMinutes = Math.max(0, (signedOffAt.toDate().getTime() - createdDate.getTime()) / 60000);
      const isoDate = createdDate.toISOString().slice(0, 10);
      if (isoDate < config.dateFrom || isoDate > config.dateTo) return;
      rowsOut.push({
        id: item.id,
        woTicket: w.woNumber ?? item.id,
        machineName: w.machineName ?? '',
        machineId: w.machineId ?? '',
        location: w.machineLocation ?? '',
        woType: w.woType ?? '',
        department: w.machineDepartment ?? '',
        createdAt,
        downtimeMinutes: Math.round(downtimeMinutes),
      });
    });
    const matchesList = (value: unknown, selected: string[]) =>
      selected.length === 0 ||
      (value != null && selected.some((s) => s.toLowerCase() === String(value).toLowerCase()));
    return rowsOut.filter(
      (row) =>
        matchesList(row.machineId, config.machines) &&
        matchesList(row.department, config.departments) &&
        matchesList(row.woType, config.woTypes),
    );
  }

  // Audit Trail now reads the Audit module's own completed sessions
  // (audit_sessions/{companyId}/sessions), not the audit_logs system
  // mutation log — the user wants to see what was audited, not who edited
  // what record.
  if (reportType === 'audit_trail') {
    const snap = await getDocs(collection(db, 'audit_sessions', companyId, 'sessions'));
    const rowsOut: Record<string, unknown>[] = [];
    snap.docs.forEach((item) => {
      const a = item.data();
      if (a.status !== 'submitted') return;
      const scopeParts: string[] = [];
      if (Array.isArray(a.machines) && a.machines.length > 0) {
        scopeParts.push((a.machines as Record<string, unknown>[]).map((m) => String(m.name ?? '')).join(', '));
      }
      if (Array.isArray(a.contractors) && a.contractors.length > 0) {
        scopeParts.push((a.contractors as Record<string, unknown>[]).map((c) => String(c.name ?? '')).join(', '));
      }
      if (a.department) scopeParts.push(String(a.department));
      if (a.location) scopeParts.push(String(a.location));
      const submittedAt = a.submittedAt ?? a.createdAt ?? a.auditDate ?? null;
      const isoDate = submittedAt && typeof (submittedAt as Timestamp).toDate === 'function'
        ? (submittedAt as Timestamp).toDate().toISOString().slice(0, 10)
        : String(a.auditDate ?? '');
      if (isoDate && /^\d{4}-\d{2}-\d{2}/.test(isoDate) && (isoDate < config.dateFrom || isoDate > config.dateTo)) return;
      rowsOut.push({
        id: item.id,
        date: submittedAt,
        category: a.category ?? '',
        categoryLabel: getCategoryLabel(String(a.category ?? ''), String(a.templateName ?? '')),
        scopeDetails: scopeParts.filter(Boolean).join(' · '),
        doneBy: a.auditorName ?? '',
        participants: Array.isArray(a.participants) ? (a.participants as Record<string, unknown>[]).map((p) => String(p.name ?? '')).filter(Boolean) : [],
        marks: Number(a.score ?? 0),
      });
    });
    return rowsOut;
  }

  // PO History is flattened to one row per PO line item (see
  // flattenPoLineItems in reportsCostUtils.ts) — PO Code, Supplier, Item,
  // Quantity, Unit Price (final invoice-confirmed price), Total, Status,
  // Raised By, Date.
  if (reportType === 'po_history') {
    const poSnap = await getDocs(
      query(collection(db, 'purchaseOrders'), where('companyId', '==', companyId), limit(1000)),
    );
    const pos = poSnap.docs.map((item) => ({ id: item.id, ...item.data() }));
    const filteredPos = pos.filter((po) => {
      const raisedAt = (po as Record<string, unknown>).raisedAt as Timestamp | undefined;
      if (!raisedAt || typeof raisedAt.toDate !== 'function') return true;
      const isoDate = raisedAt.toDate().toISOString().slice(0, 10);
      return isoDate >= config.dateFrom && isoDate <= config.dateTo;
    });
    return flattenPoLineItems(filteredPos as unknown as PoHistoryInput[]) as unknown as Record<string, unknown>[];
  }

  // Safety Incidents — the register of safety cases (incidents, near-misses,
  // hazards, unsafe acts) reported across the plant, most recent first.
  if (reportType === 'safety_incidents') {
    const snap = await getDocs(
      query(collection(db, 'safety_cases'), where('companyId', '==', companyId), limit(1000)),
    );
    const TYPE_LABEL: Record<string, string> = {
      incident: 'Incident', near_miss: 'Near-Miss', hazard: 'Hazard', unsafe_act: 'Unsafe Act',
    };
    return snap.docs
      .map((d) => d.data() as Record<string, unknown>)
      .filter((c) => {
        const ts = c.reportedAt as Timestamp | undefined;
        if (!ts || typeof ts.toDate !== 'function') return true;
        const iso = ts.toDate().toISOString().slice(0, 10);
        return iso >= config.dateFrom && iso <= config.dateTo;
      })
      .sort((a, b) => ((b.reportedAt as Timestamp)?.seconds ?? 0) - ((a.reportedAt as Timestamp)?.seconds ?? 0))
      .map((c) => ({
        type: TYPE_LABEL[String(c.type)] ?? String(c.type ?? ''),
        title: String(c.title ?? ''),
        severity: String(c.severity ?? ''),
        status: String(c.status ?? ''),
        location: String(c.location ?? ''),
        reportedByName: String(c.reportedByName ?? ''),
        reportedAt: (c.reportedAt as Timestamp | undefined)?.toDate?.().toLocaleDateString() ?? '',
      }));
  }

  // Maps each report to the Firestore collection(s) it reads from. These must
  // match the actual collection names used elsewhere in the app.
  const sourceMap: Record<ReportType, string[]> = {
    breakdown_summary: ['breakdown_tickets'],
    work_order_detail: ['workOrders'],
    // Machine History is a machine-registry snapshot (one row per machine —
    // name/type/purchased/installed/department/location/last-service/next-PM),
    // not a per-work-order history list.
    machine_history: ['machines'],
    machine_health_score: ['machine_health'],
    maintenance_cost: ['workOrders', 'stockMovements', 'contractorJobs'],
    // technician_performance (display name: "Team Performance Report") is a
    // computed branch below — role aggregation, not a raw collection.
    technician_performance: [],
    contractor_performance: ['contractorJobs'],
    inventory_usage: ['stockMovements'],
    low_stock_alert: ['inventoryParts'],
    inventory_listing: ['inventoryParts'],
    pm_compliance: ['pm_history'],
    // training_compliance is a computed branch below (per-person rollup of
    // trainingAssignments + traineeProgrammes) — not a raw collection dump.
    training_compliance: [],
    sla_compliance: ['breakdown_tickets'],
    // The Shift Handovers tab lists supervisor handovers *and* completed
    // shift sessions for every other role (see HandoverHistoryPage). The
    // report used to read handovers alone, so it showed a fraction of the
    // rows the tab does — most roles never file a handover.
    shift_handover_summary: ['shift_handovers', 'shift_sessions'],
    // downtime_analysis is a computed branch below (sourced from workOrders,
    // which unlike breakdown_tickets carries both createdAt and a sign-off
    // timestamp needed to compute downtime).
    downtime_analysis: [],
    executive_monthly: ['analytics_monthly'],
    // audit_trail now reads the Audit module's own sessions (audit_sessions/
    // {companyId}/sessions), not the audit_logs system mutation log — see the
    // computed branch below.
    audit_trail: [],
    // po_history is a computed branch below (flattened to one row per PO
    // line item).
    po_history: [],
    // safety_incidents is a computed branch above (reads the safety_cases
    // collection directly).
    safety_incidents: [],
  };

  // Registry/snapshot collections describe current state (machines, parts,
  // health scores) — filtering them by createdAt against the report date range
  // hid every entity registered before the range and produced empty reports.
  // Only event-style rows participate in date filtering.
  const snapshotSources = new Set(['machines', 'machine_health', 'inventoryParts', 'analytics_monthly']);
  const locationOf = (data: Record<string, unknown>): string =>
    [data.floor, data.bay, data.station]
      .filter((part) => part != null && part !== '')
      .map((part) => String(part))
      .join(' · ');

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
          snap.docs.forEach((item) => {
            const data = item.data();
            const row: Record<string, unknown> = { id: item.id, ...data };
            if (reportType === 'machine_history') {
              row.machineName = data.name ?? '';
              row.machineType = prettifyEnum(data.type);
              row.location = locationOf(data);
            }
            rows.push({ source, row });
          });
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
      // Inventory Listing's "Total Cost" column is a valuation figure (unit
      // cost x stock on hand), not stored on the document.
      if (reportType === 'inventory_listing') {
        (data as Record<string, unknown>).totalCost =
          Number(data.unitCost ?? 0) * Number(data.currentStock ?? 0);
      }
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

      // Shift Handover Summary: expose "Late By" minutes at a flat key
      // (overlapMinutes is "minutes the supervisor clocked in late against
      // their assigned shift's scheduled start" — see handover.types.ts) and
      // a plain count of watch flags raised during the shift.
      //
      // "Breakdowns during Shift" / "WOs during Shift" mirror what the Shift
      // Handovers tab itself shows in those columns (HandoverHistoryTable.tsx)
      // — the ongoingBreakdowns/pendingWOs snapshot lists carried into the
      // handover — NOT stats.breakdownsOpened/wosOpened, which count a
      // differently-scoped thing (breakdowns/WOs newly opened during the
      // shift, including ones already closed by handover time). The prior
      // round wired this to the stats counters, which is a real report-vs-tab
      // mismatch; fixed here to genuinely match the tab.
      if (reportType === 'shift_handover_summary') {
        // Department lives on the shift plan, not on the handover/session
        // itself — the tab resolves it the same way. Without this join the
        // Department column was always blank.
        row.shiftConfigId = String(data.shiftConfigId ?? '');
        if (source === 'shift_sessions') {
          // A session row that already rolled up into a handover would double
          // count — the tab drops those too.
          if (data.handoverId) return;
          row.personName = String(data.userName ?? '');
          row.personRole = String(data.userRole ?? '');
          row.shiftActualStart = data.actualStart ?? null;
          row.shiftActualEnd = data.actualEnd ?? null;
          row.lateByMinutes = computeLateMinutes(data.actualStart, data.scheduledStart);
          row.watchFlagsCount = 0;
          row.breakdownsOpened = 0;
          row.wosOpened = 0;
        } else {
          row.personName = String(data.outgoingSupervisorName ?? '');
          // Handovers are only ever filed by supervisors (see SUP-018).
          row.personRole = 'supervisor';
          // Same fallback the tab uses when a handover has no explicit end.
          row.shiftActualEnd = data.shiftActualEnd ?? data.handoverSubmittedAt ?? null;
          row.lateByMinutes = Number(data.overlapMinutes ?? 0);
          row.watchFlagsCount = Array.isArray(data.watchFlags) ? (data.watchFlags as unknown[]).length : 0;
          row.breakdownsOpened = Array.isArray(data.ongoingBreakdowns) ? (data.ongoingBreakdowns as unknown[]).length : 0;
          row.wosOpened = Array.isArray(data.pendingWOs) ? (data.pendingWOs as unknown[]).length : 0;
        }
      }

      rows.push({ source, row });
    });
  }

  // Shift Handover Summary's Department column: handovers and shift sessions
  // only carry a shiftConfigId, so resolve the department off the shift plan
  // exactly as the Shift Handovers tab does.
  if (reportType === 'shift_handover_summary' && rows.length > 0) {
    try {
      const shiftSnap = await getDocs(
        query(collection(db, 'shift_config'), where('companyId', '==', companyId), limit(500)),
      );
      const departmentByShiftId = new Map<string, string>();
      shiftSnap.docs.forEach((item) => {
        departmentByShiftId.set(item.id, String(item.data().department ?? ''));
      });
      rows.forEach(({ row }) => {
        row.department = departmentByShiftId.get(String(row.shiftConfigId ?? '')) ?? '';
      });
    } catch {
      // Shift plans unreadable — leave Department blank rather than failing
      // the whole report.
    }
  }

  // Inventory Usage's "Part Category" filter (availableFilters: ['part_category'])
  // compared against config.partCategories, but stockMovements rows don't
  // carry a category field at all (see StockMovement type) — the filter
  // control was shown in the UI and silently did nothing. Join each
  // movement's category from the parts catalogue by partId so the filter has
  // something real to compare against.
  if (reportType === 'inventory_usage' && rows.length > 0) {
    const partsSnap = await getDocs(
      query(collection(db, 'inventoryParts'), where('companyId', '==', companyId), limit(2000)),
    );
    const categoryByPartId = new Map<string, string>();
    partsSnap.docs.forEach((item) => {
      categoryByPartId.set(item.id, String(item.data().category ?? ''));
    });
    rows.forEach(({ row }) => {
      row.category = categoryByPartId.get(String(row.partId ?? '')) ?? '';
    });
  }

  // Surface the failure instead of silently rendering "0 records" when every
  // source was unreadable — the user needs to know it's a permissions issue.
  if (rows.length === 0 && sourceErrors.length > 0) {
    throw new Error(`Could not read report data (${sourceErrors.join('; ')})`);
  }

  // Low Stock Alert: cross-reference each currently-low/out-of-stock part
  // against purchaseOrders raised for it, to surface the PO's progress
  // status. NOTE (data-availability limitation): InventoryPart has no
  // historical "went low" event log — only current live low-stock state is
  // tracked — so "Date of Received Low Stock Alert" uses the part's
  // updatedAt as the best available proxy, and "Refilled Date" is always
  // empty for a currently-low part (a part that's since been refilled no
  // longer matches the low-stock filter above, so it can't appear here with
  // a refill date). See the PR description for the honest limitation.
  if (reportType === 'low_stock_alert' && rows.length > 0) {
    const poSnap = await getDocs(
      query(collection(db, 'purchaseOrders'), where('companyId', '==', companyId), limit(1000)),
    );
    const posByPartId = new Map<string, { status: string; raisedAtMs: number }[]>();
    poSnap.docs.forEach((item) => {
      const po = item.data();
      const items = Array.isArray(po.items) ? (po.items as Record<string, unknown>[]) : [];
      const raisedAtMs = po.raisedAt && typeof (po.raisedAt as Timestamp).toDate === 'function'
        ? (po.raisedAt as Timestamp).toDate().getTime()
        : 0;
      items.forEach((poItem) => {
        const partId = String(poItem.partId ?? '');
        if (!partId) return;
        const list = posByPartId.get(partId) ?? [];
        list.push({ status: String(po.status ?? ''), raisedAtMs });
        posByPartId.set(partId, list);
      });
    });
    rows.forEach(({ row }) => {
      const partId = String(row.id ?? '');
      const matches = posByPartId.get(partId) ?? [];
      const latest = matches.sort((a, b) => b.raisedAtMs - a.raisedAtMs)[0];
      row.lowStockAlertDate = row.updatedAt ?? null;
      row.poStatus = latest ? prettifyEnum(latest.status) : 'No PO Raised';
      row.refilledDate = null;
    });
  }

  const dateFiltered = rows
    .filter(({ source, row }) => {
      if (snapshotSources.has(source)) return true;
      const rawDate = row.createdAt ?? row.timestamp ?? row.date ?? row.generatedAt ?? row.reportedAt ?? row.raisedAt;
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

  // machine_health_score and machine_history are both keyed by machine doc-id
  // (one row per machine); other reports reference the machine via machineId.
  const isMachineReport = reportType === 'machine_health_score' || reportType === 'machine_history';

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
    if (!matchesList(row.category, config.partCategories)) return false;
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
