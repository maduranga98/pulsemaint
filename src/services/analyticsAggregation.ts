import { collection, getDocs, limit, query, where, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type {
  AnalyticsDaily,
  AnalyticsMonthly,
  MachineHealthDoc,
  TopProblemMachine,
  TechnicianPerformanceRecord,
  ContractorPerformanceRecord,
} from '../types/analytics.types';

// ---------------------------------------------------------------------------
// Client-side analytics aggregation.
//
// The dashboard/analytics module was designed to read pre-aggregated
// `analytics_monthly`, `analytics_daily` and `machine_health` collections that
// are normally produced by a backend job. When those collections are empty,
// these helpers compute equivalent data on the fly from the raw operational
// collections (breakdowns, work orders, contractor jobs, PM history) so the
// dashboards render real numbers without a backend pipeline.
// ---------------------------------------------------------------------------

type Row = Record<string, any>;

const FETCH_LIMIT = 3000;

function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (typeof value === 'object' && value !== null && 'seconds' in (value as Record<string, unknown>)) {
    return new Date(Number((value as { seconds: number }).seconds) * 1000);
  }
  if (value instanceof Date) return value;
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d;
}

const dateKey = (d: Date) => d.toISOString().slice(0, 10);
const monthKey = (d: Date) => d.toISOString().slice(0, 7);

// Short-lived promise cache so the several dashboard hooks that compute
// analytics concurrently share a single read of each collection.
const CACHE_TTL_MS = 60_000;
const fetchCache = new Map<string, { at: number; promise: Promise<Row[]> }>();

async function fetchAll(source: string, companyId: string): Promise<Row[]> {
  const key = `${source}:${companyId}`;
  const cached = fetchCache.get(key);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.promise;

  const promise = (async () => {
    try {
      const snap = await getDocs(
        query(collection(db, source), where('companyId', '==', companyId), limit(FETCH_LIMIT)),
      );
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    } catch {
      fetchCache.delete(key);
      return [];
    }
  })();
  fetchCache.set(key, { at: Date.now(), promise });
  return promise;
}

function woCost(wo: Row): number {
  const parts = Array.isArray(wo.partsUsed)
    ? wo.partsUsed.reduce((s: number, p: Row) => s + Number(p.totalCost ?? 0), 0)
    : 0;
  const labor = Array.isArray(wo.technicianWorkLogs)
    ? wo.technicianWorkLogs.reduce((s: number, l: Row) => s + Number(l.laborCost ?? 0), 0)
    : 0;
  return parts + labor;
}

const isCompletedWoStatus = (status: string) =>
  ['COMPLETED', 'SIGNED_OFF', 'CLOSED'].includes(String(status ?? ''));

const breakdownDowntimeHours = (b: Row): number => {
  const mins = Number(
    b.estimatedDowntimeMinutes ?? b.oeeImpact?.downtimeMinutes ?? 0,
  );
  if (mins > 0) return mins / 60;
  return Number(b.productionHoursLost ?? 0);
};

// ---------------------------------------------------------------------------
// Monthly aggregation
// ---------------------------------------------------------------------------

export async function computeMonthlyAnalytics(
  companyId: string,
  month: string,
): Promise<AnalyticsMonthly> {
  const [breakdowns, workOrders, contractorJobs, pmHistory] = await Promise.all([
    fetchAll('breakdown_tickets', companyId),
    fetchAll('workOrders', companyId),
    fetchAll('contractorJobs', companyId),
    fetchAll('pm_history', companyId),
  ]);

  const inMonth = (value: unknown) => {
    const d = toDate(value);
    return d ? monthKey(d) === month : false;
  };

  const monthBreakdowns = breakdowns.filter((b) => inMonth(b.reportedAt ?? b.createdAt));
  const monthWOs = workOrders.filter((w) => inMonth(w.actualEndTime ?? w.createdAt));
  const monthContractor = contractorJobs.filter((c) => inMonth(c.createdAt ?? c.workCompletedAt));
  const monthPm = pmHistory.filter((p) => inMonth(p.completedDate ?? p.dueDate));

  // MTTR (hours) over resolved breakdowns this month.
  const mttrValues: number[] = [];
  monthBreakdowns.forEach((b) => {
    const start = toDate(b.reportedAt);
    const end = toDate(b.resolvedAt);
    if (start && end && end > start) mttrValues.push((end.getTime() - start.getTime()) / 3_600_000);
  });
  const avgMttrHours = mttrValues.length ? mttrValues.reduce((a, c) => a + c, 0) / mttrValues.length : 0;

  // SLA compliance.
  const slaTotal = monthBreakdowns.length;
  const slaBreaches = monthBreakdowns.filter((b) => b.slaBreached === true).length;
  const overallSlaCompliance = slaTotal ? ((slaTotal - slaBreaches) / slaTotal) * 100 : 100;

  // Costs.
  const woCostTotal = monthWOs.reduce((s, w) => s + woCost(w), 0);
  const contractorCostTotal = monthContractor.reduce(
    (s, c) => s + Number(c.systemInvoiceAmount ?? c.contractorInvoiceAmount ?? 0),
    0,
  );
  const totalMaintenanceCost = woCostTotal + contractorCostTotal;

  const totalProductionHoursLost = monthBreakdowns.reduce((s, b) => s + breakdownDowntimeHours(b), 0);

  // PM compliance.
  const pmRelevant = monthPm.filter((p) => p.status && p.status !== 'in_progress');
  const pmOnTime = monthPm.filter((p) => p.status === 'completed_on_time').length;
  const pmComplianceRate = pmRelevant.length ? (pmOnTime / pmRelevant.length) * 100 : 0;

  // Breakdown groupings.
  const breakdownByType: Record<string, number> = {};
  const breakdownBySeverity: Record<string, number> = {};
  monthBreakdowns.forEach((b) => {
    const t = String(b.type ?? 'other');
    const s = String(b.severity ?? 'low');
    breakdownByType[t] = (breakdownByType[t] ?? 0) + 1;
    breakdownBySeverity[s] = (breakdownBySeverity[s] ?? 0) + 1;
  });

  // Top problem machines.
  const machineAgg = new Map<string, TopProblemMachine>();
  monthBreakdowns.forEach((b) => {
    const id = String(b.machineId ?? b.machineName ?? 'unknown');
    const existing = machineAgg.get(id) ?? {
      machineId: id,
      machineName: String(b.machineName ?? id),
      breakdownCount: 0,
      downtimeHours: 0,
      cost: 0,
      criticality: Number(b.machineCriticality ?? 3),
    };
    existing.breakdownCount += 1;
    existing.downtimeHours += breakdownDowntimeHours(b);
    machineAgg.set(id, existing);
  });
  monthWOs.forEach((w) => {
    const id = String(w.machineId ?? '');
    const m = machineAgg.get(id);
    if (m) m.cost += woCost(w);
  });
  const topProblemMachines = Array.from(machineAgg.values())
    .sort((a, b) => b.breakdownCount - a.breakdownCount)
    .slice(0, 10);

  // MTBF (days): for machines with breakdowns, days-in-month / count, averaged.
  const daysInMonth = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate();
  const mtbfValues = Array.from(machineAgg.values())
    .filter((m) => m.breakdownCount > 0)
    .map((m) => daysInMonth / m.breakdownCount);
  const avgMtbfDays = mtbfValues.length ? mtbfValues.reduce((a, c) => a + c, 0) / mtbfValues.length : 0;

  // Technician performance.
  const techAgg = new Map<string, TechnicianPerformanceRecord & { _repair: number[] }>();
  monthWOs.filter((w) => isCompletedWoStatus(w.status)).forEach((w) => {
    const ids: string[] = Array.isArray(w.assignedTechnicianIds) ? w.assignedTechnicianIds : [];
    const names: string[] = Array.isArray(w.assignedTechnicianNames) ? w.assignedTechnicianNames : [];
    ids.forEach((id, i) => {
      const rec = techAgg.get(id) ?? {
        techId: id,
        techName: names[i] ?? id,
        jobsCompleted: 0,
        avgResponseMins: 0,
        avgRepairHours: 0,
        slaCompliance: 100,
        _repair: [],
      };
      rec.jobsCompleted += 1;
      if (w.totalDurationMinutes) rec._repair.push(Number(w.totalDurationMinutes) / 60);
      techAgg.set(id, rec);
    });
  });
  const technicianPerformance: TechnicianPerformanceRecord[] = Array.from(techAgg.values()).map((r) => ({
    techId: r.techId,
    techName: r.techName,
    jobsCompleted: r.jobsCompleted,
    avgResponseMins: r.avgResponseMins,
    avgRepairHours: r._repair.length ? r._repair.reduce((a, c) => a + c, 0) / r._repair.length : 0,
    slaCompliance: r.slaCompliance,
  }));

  // Contractor performance.
  const conAgg = new Map<string, ContractorPerformanceRecord & { _mttr: number[]; _rating: number[] }>();
  monthContractor.forEach((c) => {
    const id = String(c.contractorId ?? c.contractorName ?? 'unknown');
    const rec = conAgg.get(id) ?? {
      contractorId: id,
      contractorName: String(c.contractorName ?? id),
      jobsCompleted: 0,
      avgMttr: 0,
      firstFixRate: 100,
      slaCompliance: 100,
      avgRating: 0,
      ratingTrend: 'stable' as const,
      _mttr: [],
      _rating: [],
    };
    rec.jobsCompleted += 1;
    const dur = Number(c.actualWorkDurationMinutes ?? c.onSiteDurationMinutes ?? 0);
    if (dur > 0) rec._mttr.push(dur / 60);
    const rating = Number(c.rating?.overallScore ?? 0);
    if (rating > 0) rec._rating.push(rating);
    conAgg.set(id, rec);
  });
  const contractorPerformance: ContractorPerformanceRecord[] = Array.from(conAgg.values()).map((r) => ({
    contractorId: r.contractorId,
    contractorName: r.contractorName,
    jobsCompleted: r.jobsCompleted,
    avgMttr: r._mttr.length ? r._mttr.reduce((a, c) => a + c, 0) / r._mttr.length : 0,
    firstFixRate: r.firstFixRate,
    slaCompliance: r.slaCompliance,
    avgRating: r._rating.length ? r._rating.reduce((a, c) => a + c, 0) / r._rating.length : 0,
    ratingTrend: r.ratingTrend,
  }));

  return {
    companyId,
    month,
    year: Number(month.slice(0, 4)),
    totalBreakdowns: monthBreakdowns.length,
    avgMttrHours: Number(avgMttrHours.toFixed(2)),
    avgMtbfDays: Number(avgMtbfDays.toFixed(1)),
    overallSlaCompliance: Number(overallSlaCompliance.toFixed(1)),
    totalMaintenanceCost: Math.round(totalMaintenanceCost),
    totalProductionHoursLost: Number(totalProductionHoursLost.toFixed(1)),
    pmComplianceRate: Number(pmComplianceRate.toFixed(1)),
    topProblemMachines,
    technicianPerformance,
    contractorPerformance,
    breakdownByType,
    breakdownBySeverity,
    updatedAt: Timestamp.now(),
  };
}

// ---------------------------------------------------------------------------
// Daily aggregation
// ---------------------------------------------------------------------------

export async function computeDailyAnalytics(
  companyId: string,
  fromDate: string,
  toDate_: string,
): Promise<AnalyticsDaily[]> {
  const [breakdowns, workOrders, contractorJobs, pmHistory] = await Promise.all([
    fetchAll('breakdown_tickets', companyId),
    fetchAll('workOrders', companyId),
    fetchAll('contractorJobs', companyId),
    fetchAll('pm_history', companyId),
  ]);

  // Build an empty entry for each date in range so charts have continuous data.
  const byDate = new Map<string, AnalyticsDaily>();
  const start = new Date(fromDate);
  const end = new Date(toDate_);
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const key = dateKey(d);
    byDate.set(key, {
      companyId,
      date: key,
      month: key.slice(0, 7),
      year: Number(key.slice(0, 4)),
      breakdownsOpened: 0,
      breakdownsClosed: 0,
      breakdownsOpen: 0,
      criticalBreakdowns: 0,
      mttrHours: 0,
      slaComplianceRate: 100,
      wosOpened: 0,
      wosCompleted: 0,
      pmsCompleted: 0,
      pmsMissed: 0,
      pmComplianceRate: 0,
      productionHoursLost: 0,
      maintenanceCostLKR: 0,
      partsCostLKR: 0,
      laborCostLKR: 0,
      contractorCostLKR: 0,
      partsIssued: 0,
      lowStockAlerts: 0,
      trainingCertificatesIssued: 0,
      safetyIncidents: 0,
      updatedAt: Timestamp.now(),
    });
  }

  const mttrAccum = new Map<string, number[]>();
  const slaAccum = new Map<string, { total: number; breached: number }>();

  breakdowns.forEach((b) => {
    const opened = toDate(b.reportedAt ?? b.createdAt);
    if (opened) {
      const k = dateKey(opened);
      const e = byDate.get(k);
      if (e) {
        e.breakdownsOpened += 1;
        if (String(b.severity) === 'critical') e.criticalBreakdowns += 1;
        e.productionHoursLost += breakdownDowntimeHours(b);
        const sla = slaAccum.get(k) ?? { total: 0, breached: 0 };
        sla.total += 1;
        if (b.slaBreached === true) sla.breached += 1;
        slaAccum.set(k, sla);
      }
    }
    const resolved = toDate(b.resolvedAt);
    if (resolved && opened && resolved > opened) {
      const k = dateKey(resolved);
      const e = byDate.get(k);
      if (e) {
        e.breakdownsClosed += 1;
        const arr = mttrAccum.get(k) ?? [];
        arr.push((resolved.getTime() - opened.getTime()) / 3_600_000);
        mttrAccum.set(k, arr);
      }
    }
  });

  workOrders.forEach((w) => {
    const created = toDate(w.createdAt);
    if (created) {
      const e = byDate.get(dateKey(created));
      if (e) e.wosOpened += 1;
    }
    const done = toDate(w.actualEndTime);
    if (done && isCompletedWoStatus(w.status)) {
      const e = byDate.get(dateKey(done));
      if (e) {
        e.wosCompleted += 1;
        const cost = woCost(w);
        e.maintenanceCostLKR += cost;
        e.partsCostLKR += Array.isArray(w.partsUsed)
          ? w.partsUsed.reduce((s: number, p: Row) => s + Number(p.totalCost ?? 0), 0)
          : 0;
      }
    }
  });

  contractorJobs.forEach((c) => {
    const done = toDate(c.workCompletedAt ?? c.createdAt);
    if (done) {
      const e = byDate.get(dateKey(done));
      if (e) {
        const amount = Number(c.systemInvoiceAmount ?? 0);
        e.contractorCostLKR += amount;
        e.maintenanceCostLKR += amount;
      }
    }
  });

  pmHistory.forEach((p) => {
    const done = toDate(p.completedDate);
    if (done) {
      const e = byDate.get(dateKey(done));
      if (e) {
        if (p.status === 'completed_on_time' || p.status === 'completed_late') e.pmsCompleted += 1;
        if (p.status === 'missed') e.pmsMissed += 1;
      }
    }
  });

  // Finalise per-day derived values.
  byDate.forEach((e, k) => {
    const mttr = mttrAccum.get(k);
    if (mttr && mttr.length) e.mttrHours = Number((mttr.reduce((a, c) => a + c, 0) / mttr.length).toFixed(2));
    const sla = slaAccum.get(k);
    if (sla && sla.total) e.slaComplianceRate = Number((((sla.total - sla.breached) / sla.total) * 100).toFixed(1));
    const pmTotal = e.pmsCompleted + e.pmsMissed;
    e.pmComplianceRate = pmTotal ? Number(((e.pmsCompleted / pmTotal) * 100).toFixed(1)) : 0;
    e.maintenanceCostLKR = Math.round(e.maintenanceCostLKR);
    e.partsCostLKR = Math.round(e.partsCostLKR);
    e.contractorCostLKR = Math.round(e.contractorCostLKR);
    e.productionHoursLost = Number(e.productionHoursLost.toFixed(1));
  });

  return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
}

// ---------------------------------------------------------------------------
// Machine health (derived from breakdowns + work orders)
// ---------------------------------------------------------------------------

export async function computeMachineHealth(companyId: string): Promise<MachineHealthDoc[]> {
  const [breakdowns, workOrders] = await Promise.all([
    fetchAll('breakdown_tickets', companyId),
    fetchAll('workOrders', companyId),
  ]);

  const now = new Date();
  const monthStr = monthKey(now);
  const machines = new Map<string, MachineHealthDoc & { _mttr: number[]; _breakdownDates: Date[] }>();

  const ensure = (id: string, seed: Row): MachineHealthDoc & { _mttr: number[]; _breakdownDates: Date[] } => {
    let m = machines.get(id);
    if (!m) {
      m = {
        companyId,
        machineId: id,
        machineIdCode: String(seed.machineId ?? id).slice(0, 6).toUpperCase(),
        machineName: String(seed.machineName ?? id),
        department: String(seed.machineDepartment ?? seed.department ?? ''),
        location: String(seed.machineLocation ?? seed.location ?? ''),
        currentStatus: 'operational',
        healthScore: 100,
        mtbfDays: 0,
        mttrHours: 0,
        lastBreakdownDate: null,
        lastServiceDate: null,
        nextPmDue: null,
        openBreakdownCount: 0,
        openWoCount: 0,
        breakdownCountMTD: 0,
        maintenanceCostMTD: 0,
        watchFlag: false,
        watchFlagLevel: null,
        updatedAt: Timestamp.now(),
        _mttr: [],
        _breakdownDates: [],
      };
      machines.set(id, m);
    }
    return m;
  };

  breakdowns.forEach((b) => {
    const id = String(b.machineId ?? b.machineName ?? 'unknown');
    const m = ensure(id, b);
    const opened = toDate(b.reportedAt ?? b.createdAt);
    if (opened) {
      m._breakdownDates.push(opened);
      if (monthKey(opened) === monthStr) m.breakdownCountMTD += 1;
      if (!m.lastBreakdownDate || opened > toDate(m.lastBreakdownDate)!) {
        m.lastBreakdownDate = Timestamp.fromDate(opened);
      }
    }
    const status = String(b.status ?? '');
    if (!['resolved', 'closed'].includes(status)) {
      m.openBreakdownCount += 1;
      m.currentStatus = 'breakdown';
    }
    const resolved = toDate(b.resolvedAt);
    if (opened && resolved && resolved > opened) {
      m._mttr.push((resolved.getTime() - opened.getTime()) / 3_600_000);
    }
  });

  workOrders.forEach((w) => {
    const id = String(w.machineId ?? '');
    if (!id) return;
    const m = machines.get(id);
    if (!m) return;
    if (!isCompletedWoStatus(w.status)) m.openWoCount += 1;
    const done = toDate(w.actualEndTime);
    if (done && monthKey(done) === monthStr) m.maintenanceCostMTD += woCost(w);
  });

  return Array.from(machines.values()).map((m) => {
    const mttrHours = m._mttr.length ? m._mttr.reduce((a, c) => a + c, 0) / m._mttr.length : 0;
    // MTBF: span of observed breakdowns / count.
    let mtbfDays = 0;
    if (m._breakdownDates.length >= 2) {
      const sorted = m._breakdownDates.sort((a, b) => a.getTime() - b.getTime());
      const spanDays = (sorted[sorted.length - 1].getTime() - sorted[0].getTime()) / 86_400_000;
      mtbfDays = spanDays / (m._breakdownDates.length - 1);
    } else if (m._breakdownDates.length === 1) {
      mtbfDays = (now.getTime() - m._breakdownDates[0].getTime()) / 86_400_000;
    }
    // Derived health score: penalise open breakdowns heavily.
    const healthScore = Math.max(0, Math.min(100, 100 - m.openBreakdownCount * 25 - m.breakdownCountMTD * 5));
    const watchFlag = m.openBreakdownCount > 0 || m.breakdownCountMTD >= 3;
    const watchFlagLevel = m.openBreakdownCount > 0
      ? 'critical_watch'
      : m.breakdownCountMTD >= 3
        ? 'monitor'
        : null;
    return {
      companyId: m.companyId,
      machineId: m.machineId,
      machineIdCode: m.machineIdCode,
      machineName: m.machineName,
      department: m.department,
      location: m.location,
      currentStatus: m.currentStatus,
      healthScore,
      mtbfDays: Number(mtbfDays.toFixed(1)),
      mttrHours: Number(mttrHours.toFixed(2)),
      lastBreakdownDate: m.lastBreakdownDate,
      lastServiceDate: m.lastServiceDate,
      nextPmDue: m.nextPmDue,
      openBreakdownCount: m.openBreakdownCount,
      openWoCount: m.openWoCount,
      breakdownCountMTD: m.breakdownCountMTD,
      maintenanceCostMTD: Math.round(m.maintenanceCostMTD),
      watchFlag,
      watchFlagLevel: watchFlagLevel as MachineHealthDoc['watchFlagLevel'],
      updatedAt: Timestamp.now(),
    };
  });
}
