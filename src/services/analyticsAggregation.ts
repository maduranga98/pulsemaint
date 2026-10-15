import { collection, getDocs, onSnapshot, query, where, Timestamp } from 'firebase/firestore';
import { plantConstraints, rulesPlantId } from '../lib/plantQuery';
import { db } from '../lib/firebase';
import { useAuthStore } from '../store/authStore';
import type {
  AnalyticsDaily,
  AnalyticsMonthly,
  MachineHealthDoc,
  TopProblemMachine,
  TechnicianPerformanceRecord,
  ContractorPerformanceRecord,
} from '../types/analytics.types';
import { getEffectivePMHistoryStatus } from '../utils/pm.utils';
import { computeEffectiveCostPerHour } from '../lib/downtimeCost';
import { computeDowntimeEvents, sumDowntimeHours } from '../lib/machineDowntime';
import { HEALTH_WINDOW_DAYS, machineHealthScoreFromRecords } from '../lib/machineHealth';
import {
  woCost as sharedWoCost,
  woPartsCost as sharedWoPartsCost,
  woLaborCost,
  woDoneAt,
  woSlaOutcome,
  slaCompliance,
  isCancelledBreakdown,
  isCountableContractorJob,
  contractorJobCost,
  contractorJobCostDate,
  elapsedHoursInMonths,
  mtbfDays,
} from '../lib/analytics/maintenanceMetrics';

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

export function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (typeof value === 'object' && value !== null && 'seconds' in (value as Record<string, unknown>)) {
    return new Date(Number((value as { seconds: number }).seconds) * 1000);
  }
  if (value instanceof Date) return value;
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d;
}

// Calendar keys in local time (the plant's own clock) — UTC keys put events
// from 00:00–05:30 in Sri Lanka on the previous day, and month-end events in
// the previous month.
const pad2 = (n: number) => String(n).padStart(2, '0');
export const dateKey = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
export const monthKey = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;

// Sources that failed to load in the current session (permissions, network)
// — surfaced on the result as `incompleteSources` instead of silently
// counting them as zero.
const failedSources = new Set<string>();
export function incompleteSources(): string[] {
  return [...failedSources];
}

/**
 * A month selector for the analytics computations: a single 'YYYY-MM', a list
 * of them (the range selector — e.g. the last 3/6/12 months), or 'all' (every
 * record). Letting the same computation take a set of months is what makes the
 * Analytics page's MTD / 3M / 6M / 12M range drive every section.
 */
export type MonthArg = string | string[];

function monthMatcher(month: MonthArg): { has: (d: Date | null) => boolean; list: string[] | null } {
  if (month === 'all') return { has: () => true, list: null };
  const list = Array.isArray(month) ? month : [month];
  const set = new Set(list);
  return { has: (d) => (d ? set.has(monthKey(d)) : false), list };
}

// Short-lived promise cache so the several dashboard hooks that compute
// analytics concurrently share a single read of each collection.
const CACHE_TTL_MS = 60_000;
const fetchCache = new Map<string, { at: number; promise: Promise<Row[]> }>();

async function fetchAll(source: string, companyId: string): Promise<Row[]> {
  // Per plant too: a plant-scoped user only reads their own plant's records.
  const key = `${source}:${companyId}:${rulesPlantId() ?? '*'}`;
  const cached = fetchCache.get(key);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.promise;

  // Every record of the company — the old limit(3000) with no ordering
  // returned an arbitrary subset once a company had more, so totals were
  // silently wrong.
  const promise = (async () => {
    try {
      const snap = await getDocs(query(collection(db, source), where('companyId', '==', companyId), ...plantConstraints(source)));
      failedSources.delete(source);
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    } catch (err) {
      console.error(`Analytics: could not load ${source}`, err);
      failedSources.add(source);
      fetchCache.delete(key);
      return [];
    }
  })();
  fetchCache.set(key, { at: Date.now(), promise });
  return promise;
}

// Machines are scoped by siteId, not companyId — every other collection here
// carries companyId, so this needs its own query field. In this codebase's
// single-site-per-company deployments, companyId doubles as the site id
// (see e.g. useMachines({ siteId: company.id }) elsewhere).
async function fetchMachines(companyId: string): Promise<Row[]> {
  const key = `machines:${companyId}:${rulesPlantId() ?? '*'}`;
  const cached = fetchCache.get(key);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.promise;

  const promise = (async () => {
    try {
      const snap = await getDocs(query(collection(db, 'machines'), where('siteId', '==', companyId), ...plantConstraints('machines')));
      failedSources.delete('machines');
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    } catch (err) {
      console.error('Analytics: could not load machines', err);
      failedSources.add('machines');
      fetchCache.delete(key);
      return [];
    }
  })();
  fetchCache.set(key, { at: Date.now(), promise });
  return promise;
}

// Cost rules shared with reports (lib/analytics/maintenanceMetrics): parts
// consumed + labour (logged hours × labour rate, priced by the costWorkOrder
// Cloud Function).
const woPartsCost = sharedWoPartsCost;
const woCost = sharedWoCost;

const SEVERITY_RANK: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };
const SEVERITY_BY_RANK: Array<TopProblemMachine['severity']> = ['low', 'low', 'medium', 'high', 'critical'];
const severityFromRank = (rank: number): TopProblemMachine['severity'] =>
  SEVERITY_BY_RANK[Math.max(0, Math.min(4, rank))];

const isCompletedWoStatus = (status: string) =>
  ['COMPLETED', 'SIGNED_OFF', 'CLOSED'].includes(String(status ?? ''));

/** Recorded downtime estimate, for old tickets with nothing to measure from. */
export const breakdownDowntimeHours = (b: Row): number => {
  const mins = Number(
    b.estimatedDowntimeMinutes ?? b.oeeImpact?.downtimeMinutes ?? 0,
  );
  if (mins > 0) return mins / 60;
  return Number(b.productionHoursLost ?? 0);
};

// ---------------------------------------------------------------------------
// Monthly aggregation
// ---------------------------------------------------------------------------

export interface MonthlyRawData {
  breakdowns: Row[];
  workOrders: Row[];
  contractorJobs: Row[];
  pmHistory: Row[];
  machines: Row[];
}

export async function computeMonthlyAnalytics(
  companyId: string,
  month: MonthArg,
  plantId: string | null = null,
): Promise<AnalyticsMonthly> {
  const [breakdowns, workOrders, contractorJobs, pmHistory, machines] = await Promise.all([
    fetchAll('breakdown_tickets', companyId),
    fetchAll('workOrders', companyId),
    fetchAll('contractorJobs', companyId),
    fetchAll('pm_history', companyId),
    fetchMachines(companyId),
  ]);
  const raw = { breakdowns, workOrders, contractorJobs, pmHistory, machines };
  return buildMonthlyAnalytics(companyId, month, plantId ? scopeRawToPlant(raw, plantId) : raw);
}

/**
 * Live monthly analytics — subscribes to the raw operational collections and
 * recomputes the aggregate whenever any of them change, so dashboards stay in
 * sync without manual refresh. Returns an unsubscribe function.
 */
export function subscribeMonthlyAnalytics(
  companyId: string,
  month: MonthArg,
  callback: (data: AnalyticsMonthly) => void,
  plantId: string | null = null,
): () => void {
  if (!companyId) return () => {};

  const raw: MonthlyRawData = { breakdowns: [], workOrders: [], contractorJobs: [], pmHistory: [], machines: [] };
  const ready = { breakdown_tickets: false, workOrders: false, contractorJobs: false, pm_history: false, machines: false };

  const emit = () => {
    // Wait until every listener has delivered its first snapshot so the first
    // emitted aggregate isn't computed from partial data.
    if (!Object.values(ready).every(Boolean)) return;
    callback(buildMonthlyAnalytics(companyId, month, plantId ? scopeRawToPlant(raw, plantId) : raw));
  };

  const listen = (
    source: Exclude<keyof typeof ready, 'machines'>,
    assign: (rows: Row[]) => void,
  ) =>
    onSnapshot(
      query(collection(db, source), where('companyId', '==', companyId), ...plantConstraints(source)),
      (snap) => {
        assign(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        failedSources.delete(source);
        ready[source] = true;
        emit();
      },
      (err) => {
        // The dashboard still renders, flagged as incomplete.
        console.error(`Analytics: could not load ${source}`, err);
        failedSources.add(source);
        ready[source] = true;
        emit();
      },
    );

  // Machines are scoped by siteId, not companyId — see fetchMachines().
  const unsubMachines = onSnapshot(
    query(collection(db, 'machines'), where('siteId', '==', companyId), ...plantConstraints('machines')),
    (snap) => {
      raw.machines = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      failedSources.delete('machines');
      ready.machines = true;
      emit();
    },
    (err) => {
      console.error('Analytics: could not load machines', err);
      failedSources.add('machines');
      ready.machines = true;
      emit();
    },
  );

  const unsubs = [
    listen('breakdown_tickets', (rows) => (raw.breakdowns = rows)),
    listen('workOrders', (rows) => (raw.workOrders = rows)),
    listen('contractorJobs', (rows) => (raw.contractorJobs = rows)),
    listen('pm_history', (rows) => (raw.pmHistory = rows)),
    unsubMachines,
  ];
  return () => unsubs.forEach((u) => u());
}

/**
 * Narrow raw operational data to a single plant: machines by their own
 * plantId, and every other record by its denormalized machinePlantId/plantId
 * or, failing that, by whether its machine belongs to the plant.
 */
function plantRowFilter(machines: Row[], plantId: string): (row: Row) => boolean {
  const machineIds = new Set(machines.filter((m) => m.plantId === plantId).map((m) => String(m.id)));
  return (row: Row) => {
    const rowPlant = row.machinePlantId ?? row.plantId;
    if (rowPlant) return rowPlant === plantId;
    return row.machineId != null && machineIds.has(String(row.machineId));
  };
}

function scopeRawToPlant(raw: MonthlyRawData, plantId: string): MonthlyRawData {
  const machines = raw.machines.filter((m) => m.plantId === plantId);
  const inPlant = plantRowFilter(raw.machines, plantId);
  return {
    machines,
    breakdowns: raw.breakdowns.filter(inPlant),
    workOrders: raw.workOrders.filter(inPlant),
    contractorJobs: raw.contractorJobs.filter(inPlant),
    pmHistory: raw.pmHistory.filter(inPlant),
  };
}

/**
 * The monthly figures from raw records. Exported for the parity test with the
 * server copy (functions/src/analytics/monthlyAnalytics.js).
 */
export function buildMonthlyAnalytics(
  companyId: string,
  month: MonthArg,
  { breakdowns, workOrders, contractorJobs, pmHistory, machines }: MonthlyRawData,
  now: Date = new Date(),
): AnalyticsMonthly {
  // month === 'all' aggregates across all time (dashboard fallback); a string
  // is a single month; an array is a multi-month range (the range selector).
  const matcher = monthMatcher(month);
  const lastMonth = matcher.list ? matcher.list[matcher.list.length - 1] : null;
  const inMonth = (value: unknown) => matcher.has(toDate(value));

  // Cancelled tickets were never failures — not in counts, groupings or MTBF.
  const monthBreakdowns = breakdowns.filter((b) => !isCancelledBreakdown(b) && inMonth(b.reportedAt ?? b.createdAt));
  // Work counts (and costs) when it was done; cancelled work orders are out.
  const monthWOs = workOrders.filter((w) => String(w.status ?? '') !== 'CANCELLED' && inMonth(woDoneAt(w) ?? w.createdAt));
  // Contractor cost counts when the work was done (like work orders), not
  // when the job was raised; cancelled jobs cost nothing.
  const monthContractor = contractorJobs.filter((c) => isCountableContractorJob(c) && inMonth(contractorJobCostDate(c)));
  // A PM occurrence belongs to the month it was due, whenever it was done.
  const monthPm = pmHistory.filter((p) => inMonth(p.dueDate ?? p.completedDate));

  // Costs.
  const woCostTotal = monthWOs.reduce((s, w) => s + woCost(w), 0);
  const contractorCostTotal = monthContractor.reduce((s, c) => s + contractorJobCost(c), 0);
  const totalMaintenanceCost = woCostTotal + contractorCostTotal;

  // SLA compliance — work orders whose SLA deadline fell in the period: done
  // in time vs late / still open past it. (Breakdown tickets carry no SLA
  // deadline of their own, so the old ticket-based figure was always 100 %.)
  const sla = slaCompliance(workOrders, (d) => matcher.has(d), now);
  const overallSlaCompliance = sla.rate ?? 100;

  // Production downtime is captured primarily from work-order completion
  // durations for unplanned work (breakdowns / corrective), where the real
  // repair time is logged, plus any downtime explicitly recorded on breakdown
  // tickets. This keeps the "Production Hours Lost" figure live off WO data
  // instead of sitting at zero when breakdowns carry no downtime field.
  // Downtime is real elapsed time: breakdown reported → supervisor sign-off,
  // and other maintenance start → sign-off (see lib/machineDowntime).
  const monthDowntime = computeDowntimeEvents(breakdowns, workOrders, now, breakdownDowntimeHours)
    .filter((e) => inMonth(e.anchor));
  const totalProductionHoursLost = sumDowntimeHours(monthDowntime);

  // MTTR (hours): mean time to restore a broken-down machine — reported until
  // signed off, the same window downtime is measured over. Breakdowns still
  // open aren't restored yet, so they don't count.
  const mttrValues = monthDowntime.filter((e) => e.kind === 'breakdown' && !e.ongoing).map((e) => e.hours);
  const avgMttrHours = mttrValues.length ? mttrValues.reduce((a, c) => a + c, 0) / mttrValues.length : 0;

  // Downtime cost: each machine's own Downtime Cost (LKR/hour, set on the
  // Machine record) applied to that machine's downtime hours this month —
  // the same breakdown-ticket + unplanned-WO hours that make up
  // totalProductionHoursLost above, just attributed per machine instead of
  // totaled flat. Machines without a configured rate contribute nothing
  // (rather than guessing at a cost), so this is a floor, not an estimate.
  const machineCostPerHour = new Map<string, number>();
  machines.forEach((m) => {
    const rate = computeEffectiveCostPerHour(
      m.costPerHourDown ?? null,
      m.unitsPerHour ?? null,
      m.unitValue ?? null,
    );
    if (rate !== null) machineCostPerHour.set(String(m.id), rate);
  });
  const machineDowntimeHoursForCost = new Map<string, number>();
  const addMachineDowntimeHours = (machineId: unknown, hours: number) => {
    if (!machineId || hours <= 0) return;
    const id = String(machineId);
    machineDowntimeHoursForCost.set(id, (machineDowntimeHoursForCost.get(id) ?? 0) + hours);
  };
  monthDowntime.forEach((e) => addMachineDowntimeHours(e.machineId, e.hours));
  let totalDowntimeCost = 0;
  machineDowntimeHoursForCost.forEach((hours, machineId) => {
    const rate = machineCostPerHour.get(machineId);
    if (rate !== undefined) totalDowntimeCost += hours * rate;
  });

  // PM compliance. Overdue PMs are never stamped 'overdue' in Firestore, so an
  // uncompleted PM past its due date is derived as overdue here and counted as
  // missed — otherwise overdue PMs never surface in analytics.
  const pmEff = monthPm.map((p) => getEffectivePMHistoryStatus(p));
  const pmRelevant = pmEff.filter((s) => s && s !== 'in_progress');
  const pmOnTime = pmEff.filter((s) => s === 'completed_on_time').length;
  const pmMissed = pmEff.filter((s) => s === 'missed' || s === 'overdue').length;
  // Nothing fell due → 100 (the server's schedule complianceRate uses the same rule).
  const pmComplianceRate = pmRelevant.length ? (pmOnTime / pmRelevant.length) * 100 : 100;

  // Breakdown groupings.
  const breakdownByType: Record<string, number> = {};
  const breakdownBySeverity: Record<string, number> = {};
  const breakdownByDepartment: Record<string, number> = {};
  monthBreakdowns.forEach((b) => {
    const t = String(b.type ?? 'other');
    const s = String(b.severity ?? 'low');
    const dept = String(b.machineDepartment ?? b.department ?? 'Unassigned').trim() || 'Unassigned';
    breakdownByType[t] = (breakdownByType[t] ?? 0) + 1;
    breakdownBySeverity[s] = (breakdownBySeverity[s] ?? 0) + 1;
    breakdownByDepartment[dept] = (breakdownByDepartment[dept] ?? 0) + 1;
  });

  // Top problem machines — work-order centric: Count = number of WOs, Hours =
  // sum of WO completion durations, Cost = sum of inventory parts cost across
  // the machine's WOs. Breakdown counts are still tracked for other consumers,
  // and the bar colour reflects the machine's highest severity.
  type MachineAgg = TopProblemMachine & { _sevRank: number };
  const machineAgg = new Map<string, MachineAgg>();
  const ensureMachine = (id: string, name: string, criticality: number): MachineAgg => {
    let m = machineAgg.get(id);
    if (!m) {
      m = {
        machineId: id,
        machineName: name,
        breakdownCount: 0,
        woCount: 0,
        downtimeHours: 0,
        cost: 0,
        criticality,
        severity: 'low',
        _sevRank: 0,
      };
      machineAgg.set(id, m);
    }
    return m;
  };
  monthBreakdowns.forEach((b) => {
    const id = String(b.machineId ?? b.machineName ?? 'unknown');
    const m = ensureMachine(id, String(b.machineName ?? id), Number(b.machineCriticality ?? 3));
    m.breakdownCount += 1;
    m._sevRank = Math.max(m._sevRank, SEVERITY_RANK[String(b.severity ?? 'low')] ?? 1);
  });
  monthWOs.forEach((w) => {
    const id = String(w.machineId ?? w.machineName ?? '');
    if (!id) return;
    const m = ensureMachine(id, String(w.machineName ?? id), Number(w.machineCriticality ?? 3));
    m.woCount += 1;
    m.cost += woPartsCost(w);
    m._sevRank = Math.max(m._sevRank, SEVERITY_RANK[String(w.priority ?? 'low')] ?? 1);
  });
  monthDowntime.forEach((e) => {
    const id = String(e.machineId ?? e.machineName ?? '');
    if (!id) return;
    ensureMachine(id, e.machineName || id, e.machineCriticality).downtimeHours += e.hours;
  });
  // Contractor jobs signed off this month add their cost to the machine they
  // were performed on, so the machine's cost roll-up reflects external work too.
  monthContractor.forEach((c) => {
    const id = String(c.machineId ?? c.machineName ?? '');
    if (!id) return;
    const m = ensureMachine(id, String(c.machineName ?? id), Number(c.machineCriticality ?? 3));
    m.cost += contractorJobCost(c);
  });
  const topProblemMachines: TopProblemMachine[] = Array.from(machineAgg.values())
    // Rank by WO count, then breakdown count as a tie-breaker.
    .sort((a, b) => b.woCount - a.woCount || b.breakdownCount - a.breakdownCount)
    .slice(0, 10)
    .map(({ _sevRank, ...m }) => ({
      ...m,
      downtimeHours: Number(m.downtimeHours.toFixed(1)),
      cost: Math.round(m.cost),
      severity: severityFromRank(_sevRank),
    }));

  // MTBF (days): operating time between failures — for each machine that
  // failed, (elapsed window − its downtime) / its failures, averaged. The
  // window only counts time that has passed (the current month up to now);
  // 'all' uses the span from the first breakdown to now.
  const firstBreakdown = monthBreakdowns.reduce<Date | null>((min, b) => {
    const d = toDate(b.reportedAt ?? b.createdAt);
    return d && (!min || d < min) ? d : min;
  }, null);
  const windowHours = matcher.list == null
    ? (firstBreakdown ? Math.max(0, now.getTime() - firstBreakdown.getTime()) / 3_600_000 : 0)
    : elapsedHoursInMonths(matcher.list, now);
  const failures = new Map<string, number>();
  const downtimeByMachine = new Map<string, number>();
  machineAgg.forEach((m) => {
    if (m.breakdownCount > 0) failures.set(m.machineId, m.breakdownCount);
    downtimeByMachine.set(m.machineId, m.downtimeHours);
  });
  const avgMtbfDays = mtbfDays(failures, downtimeByMachine, windowHours);

  // Technician performance. Response time = (work started) - (created); SLA
  // compliance from the WO's slaBreached flag — both from real WO data.
  const techAgg = new Map<
    string,
    { techId: string; techName: string; jobsCompleted: number; _repair: number[]; _response: number[]; _slaTotal: number; _slaOk: number }
  >();
  monthWOs.filter((w) => isCompletedWoStatus(w.status)).forEach((w) => {
    const ids: string[] = Array.isArray(w.assignedTechnicianIds) ? w.assignedTechnicianIds : [];
    const names: string[] = Array.isArray(w.assignedTechnicianNames) ? w.assignedTechnicianNames : [];
    const created = toDate(w.createdAt);
    const started = toDate(w.actualStartTime);
    const responseMins = created && started && started > created
      ? (started.getTime() - created.getTime()) / 60_000
      : null;
    ids.forEach((id, i) => {
      const rec = techAgg.get(id) ?? {
        techId: id,
        techName: names[i] ?? id,
        jobsCompleted: 0,
        _repair: [],
        _response: [],
        _slaTotal: 0,
        _slaOk: 0,
      };
      rec.jobsCompleted += 1;
      if (w.totalDurationMinutes) rec._repair.push(Number(w.totalDurationMinutes) / 60);
      if (responseMins != null) rec._response.push(responseMins);
      const outcome = woSlaOutcome(w, now);
      if (outcome === 'met' || outcome === 'breached') {
        rec._slaTotal += 1;
        if (outcome === 'met') rec._slaOk += 1;
      }
      techAgg.set(id, rec);
    });
  });
  const avg = (arr: number[]) => (arr.length ? arr.reduce((a, c) => a + c, 0) / arr.length : 0);
  const technicianPerformance: TechnicianPerformanceRecord[] = Array.from(techAgg.values()).map((r) => ({
    techId: r.techId,
    techName: r.techName,
    jobsCompleted: r.jobsCompleted,
    avgResponseMins: Number(avg(r._response).toFixed(1)),
    avgRepairHours: Number(avg(r._repair).toFixed(2)),
    slaCompliance: r._slaTotal ? Number(((r._slaOk / r._slaTotal) * 100).toFixed(1)) : 100,
  }));

  // Contractor performance. SLA compliance is derived from slaDeadline vs the
  // completion time; first-fix uses a real field when present, otherwise a
  // proxy of jobs that completed without a recorded return visit.
  const conAgg = new Map<
    string,
    { contractorId: string; contractorName: string; jobsCompleted: number; _mttr: number[]; _rating: number[]; _slaTotal: number; _slaOk: number; _firstFix: number; _firstFixTotal: number }
  >();
  monthContractor.forEach((c) => {
    const id = String(c.contractorId ?? c.contractorName ?? 'unknown');
    const rec = conAgg.get(id) ?? {
      contractorId: id,
      contractorName: String(c.contractorName ?? id),
      jobsCompleted: 0,
      _mttr: [],
      _rating: [],
      _slaTotal: 0,
      _slaOk: 0,
      _firstFix: 0,
      _firstFixTotal: 0,
    };
    rec.jobsCompleted += 1;
    const dur = Number(c.actualWorkDurationMinutes ?? c.onSiteDurationMinutes ?? 0);
    if (dur > 0) rec._mttr.push(dur / 60);
    const rating = Number(c.rating?.overallScore ?? 0);
    if (rating > 0) rec._rating.push(rating);

    const slaDeadline = toDate(c.slaDeadline);
    const completed = toDate(c.workCompletedAt ?? c.departedAt);
    if (slaDeadline && completed) {
      rec._slaTotal += 1;
      if (completed <= slaDeadline) rec._slaOk += 1;
    }

    if (typeof c.firstTimeFix === 'boolean' || c.requiresReturnVisit != null || c.reopened != null) {
      rec._firstFixTotal += 1;
      const firstFix = c.firstTimeFix === true || (c.requiresReturnVisit !== true && c.reopened !== true);
      if (firstFix) rec._firstFix += 1;
    }
    conAgg.set(id, rec);
  });
  const contractorPerformance: ContractorPerformanceRecord[] = Array.from(conAgg.values()).map((r) => ({
    contractorId: r.contractorId,
    contractorName: r.contractorName,
    jobsCompleted: r.jobsCompleted,
    avgMttr: Number(avg(r._mttr).toFixed(2)),
    firstFixRate: r._firstFixTotal ? Number(((r._firstFix / r._firstFixTotal) * 100).toFixed(1)) : 100,
    slaCompliance: r._slaTotal ? Number(((r._slaOk / r._slaTotal) * 100).toFixed(1)) : 100,
    avgRating: Number(avg(r._rating).toFixed(2)),
    ratingTrend: 'stable',
  }));

  return {
    companyId,
    month: typeof month === 'string' ? month : (lastMonth ?? ''),
    year: lastMonth ? Number(lastMonth.slice(0, 4)) : new Date().getFullYear(),
    totalBreakdowns: monthBreakdowns.length,
    avgMttrHours: Number(avgMttrHours.toFixed(2)),
    avgMtbfDays: Number(avgMtbfDays.toFixed(1)),
    overallSlaCompliance: Number(overallSlaCompliance.toFixed(1)),
    totalMaintenanceCost: Math.round(totalMaintenanceCost),
    totalProductionHoursLost: Number(totalProductionHoursLost.toFixed(1)),
    totalDowntimeCost: Math.round(totalDowntimeCost),
    pmComplianceRate: Number(pmComplianceRate.toFixed(1)),
    slaMet: sla.met,
    slaBreached: sla.breached,
    incompleteSources: incompleteSources(),
    pmCompletedOnTime: pmOnTime,
    pmMissed,
    topProblemMachines,
    technicianPerformance,
    contractorPerformance,
    breakdownByType,
    breakdownBySeverity,
    breakdownByDepartment,
    updatedAt: Timestamp.now(),
  };
}

// ---------------------------------------------------------------------------
// Breakdown heatmap — day-of-week × hour-of-day buckets straight from the
// raw breakdown tickets, so the heatmap reflects the real report times
// (the daily analytics docs only carry per-day totals, not hours).
// ---------------------------------------------------------------------------

export async function computeBreakdownHeatmap(
  companyId: string,
  fromDate: string,
  toDate_: string,
  plantId: string | null = null,
): Promise<Array<{ day: number; hour: number; count: number; machineNames: string[] }>> {
  const [allBreakdowns, machines] = await Promise.all([
    fetchAll('breakdown_tickets', companyId),
    plantId ? fetchMachines(companyId) : Promise.resolve([] as Row[]),
  ]);
  // Older tickets carry no machinePlantId — fall back to the machine's plant.
  const inPlant = plantId ? plantRowFilter(machines, plantId) : () => true;
  const breakdowns = allBreakdowns.filter((b) => !isCancelledBreakdown(b) && inPlant(b));
  const from = new Date(`${fromDate}T00:00:00`);
  const to = new Date(`${toDate_}T23:59:59.999`);

  const buckets = new Map<string, { day: number; hour: number; count: number; machineNames: string[] }>();
  breakdowns.forEach((b) => {
    const opened = toDate(b.reportedAt ?? b.createdAt);
    if (!opened || opened < from || opened > to) return;
    const day = (opened.getDay() + 6) % 7; // Mon=0 … Sun=6
    const hour = opened.getHours();
    const key = `${day}:${hour}`;
    const cell = buckets.get(key) ?? { day, hour, count: 0, machineNames: [] };
    cell.count += 1;
    const machineName = String(b.machineName ?? '').trim();
    if (machineName && !cell.machineNames.includes(machineName)) cell.machineNames.push(machineName);
    buckets.set(key, cell);
  });
  return Array.from(buckets.values());
}

// ---------------------------------------------------------------------------
// Maintenance cost by WO type — total (parts + labor) cost of work orders
// completed this month, grouped by their WO type, for the Maintenance Cost
// Overview chart.
// ---------------------------------------------------------------------------

export async function computeCostByWoType(
  companyId: string,
  month: MonthArg,
  plantId: string | null = null,
): Promise<Array<{ woType: string; cost: number }>> {
  const [allWorkOrders, machines] = await Promise.all([
    fetchAll('workOrders', companyId),
    plantId ? fetchMachines(companyId) : Promise.resolve([] as Row[]),
  ]);
  const inPlant = plantId ? plantRowFilter(machines, plantId) : () => true;
  const workOrders = allWorkOrders.filter((w) => inPlant(w));
  const matcher = monthMatcher(month);
  const inMonth = (value: unknown) => matcher.has(toDate(value));
  // Same rows as the monthly maintenance cost: by when the work was done,
  // cancelled work orders out.
  const monthWOs = workOrders.filter((w) => String(w.status ?? '') !== 'CANCELLED' && inMonth(woDoneAt(w) ?? w.createdAt));

  const totals = new Map<string, number>();
  monthWOs.forEach((w) => {
    const type = String(w.woType ?? 'OTHER');
    totals.set(type, (totals.get(type) ?? 0) + woCost(w));
  });

  return Array.from(totals.entries())
    .map(([woType, cost]) => ({ woType, cost: Math.round(cost) }))
    .filter((row) => row.cost > 0)
    .sort((a, b) => b.cost - a.cost);
}

// ---------------------------------------------------------------------------
// Daily aggregation
// ---------------------------------------------------------------------------

export async function computeDailyAnalytics(
  companyId: string,
  fromDate: string,
  toDate_: string,
  plantId: string | null = null,
): Promise<AnalyticsDaily[]> {
  const [allBreakdowns, allWorkOrders, allContractorJobs, allPmHistory, allMachines] = await Promise.all([
    fetchAll('breakdown_tickets', companyId),
    fetchAll('workOrders', companyId),
    fetchAll('contractorJobs', companyId),
    fetchAll('pm_history', companyId),
    plantId ? fetchMachines(companyId) : Promise.resolve([] as Row[]),
  ]);
  const { breakdowns, workOrders, contractorJobs, pmHistory } = plantId
    ? scopeRawToPlant(
        {
          breakdowns: allBreakdowns,
          workOrders: allWorkOrders,
          contractorJobs: allContractorJobs,
          pmHistory: allPmHistory,
          machines: allMachines,
        },
        plantId,
      )
    : { breakdowns: allBreakdowns, workOrders: allWorkOrders, contractorJobs: allContractorJobs, pmHistory: allPmHistory };

  const now = new Date();
  // Real elapsed downtime (reported → supervisor sign-off, other maintenance
  // start → sign-off) — the same events the monthly figures sum.
  const downtimeEvents = computeDowntimeEvents(breakdowns, workOrders, now, breakdownDowntimeHours);

  // Build an empty entry for each date in range so charts have continuous data.
  const byDate = new Map<string, AnalyticsDaily>();
  const start = new Date(`${fromDate}T00:00:00`);
  const end = new Date(`${toDate_}T00:00:00`);
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
      pmComplianceRate: 100,
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
  const dayOf = (value: unknown) => {
    const d = toDate(value);
    return d ? byDate.get(dateKey(d)) : undefined;
  };

  // Cancelled tickets were never failures.
  breakdowns.forEach((b) => {
    if (isCancelledBreakdown(b)) return;
    const e = dayOf(b.reportedAt ?? b.createdAt);
    if (!e) return;
    e.breakdownsOpened += 1;
    if (String(b.severity) === 'critical') e.criticalBreakdowns += 1;
  });

  // Downtime on the day it is attributed to (as the monthly total does);
  // MTTR and "closed" on the day the machine was signed back into service.
  const mttrAccum = new Map<string, number[]>();
  downtimeEvents.forEach((ev) => {
    const anchored = dayOf(ev.anchor);
    if (anchored) anchored.productionHoursLost += ev.hours;
    if (ev.kind !== 'breakdown' || ev.ongoing) return;
    const k = dateKey(ev.end);
    const e = byDate.get(k);
    if (!e) return;
    e.breakdownsClosed += 1;
    mttrAccum.set(k, [...(mttrAccum.get(k) ?? []), ev.hours]);
  });

  workOrders.forEach((w) => {
    const opened = dayOf(w.createdAt);
    if (opened) opened.wosOpened += 1;
    if (!isCompletedWoStatus(w.status)) return;
    const e = dayOf(woDoneAt(w));
    if (!e) return;
    e.wosCompleted += 1;
    const parts = woPartsCost(w);
    const labour = woLaborCost(w);
    e.partsCostLKR += parts;
    e.laborCostLKR += labour;
    e.maintenanceCostLKR += parts + labour;
  });

  // SLA: work orders whose deadline fell on the day — met vs breached.
  const slaAccum = new Map<string, { met: number; breached: number }>();
  workOrders.forEach((w) => {
    const deadline = toDate(w.slaDeadline);
    if (!deadline) return;
    const k = dateKey(deadline);
    if (!byDate.has(k)) return;
    const outcome = woSlaOutcome(w, now);
    if (outcome !== 'met' && outcome !== 'breached') return;
    const acc = slaAccum.get(k) ?? { met: 0, breached: 0 };
    acc[outcome] += 1;
    slaAccum.set(k, acc);
  });

  // Contractor cost when the work was done; cancelled jobs cost nothing.
  contractorJobs.forEach((c) => {
    if (!isCountableContractorJob(c)) return;
    const e = dayOf(contractorJobCostDate(c));
    if (!e) return;
    const amount = contractorJobCost(c);
    e.contractorCostLKR += amount;
    e.maintenanceCostLKR += amount;
  });

  // PM occurrences on the day they were due (the monthly rule), with overdue
  // ones still open counted as missed.
  const pmOnTime = new Map<string, number>();
  pmHistory.forEach((p) => {
    const d = toDate(p.dueDate ?? p.completedDate);
    if (!d) return;
    const k = dateKey(d);
    const e = byDate.get(k);
    if (!e) return;
    const status = getEffectivePMHistoryStatus(p, now);
    if (status === 'completed_on_time' || status === 'completed_late') e.pmsCompleted += 1;
    if (status === 'missed' || status === 'overdue') e.pmsMissed += 1;
    if (status === 'completed_on_time') pmOnTime.set(k, (pmOnTime.get(k) ?? 0) + 1);
  });

  // Finalise per-day derived values.
  byDate.forEach((e, k) => {
    const mttr = mttrAccum.get(k);
    if (mttr && mttr.length) e.mttrHours = Number((mttr.reduce((a, c) => a + c, 0) / mttr.length).toFixed(2));
    const sla = slaAccum.get(k);
    if (sla && sla.met + sla.breached) e.slaComplianceRate = Number(((sla.met / (sla.met + sla.breached)) * 100).toFixed(1));
    const pmTotal = e.pmsCompleted + e.pmsMissed;
    // On time / everything that fell due — 100 when nothing did (monthly rule).
    e.pmComplianceRate = pmTotal ? Number((((pmOnTime.get(k) ?? 0) / pmTotal) * 100).toFixed(1)) : 100;
    e.maintenanceCostLKR = Math.round(e.maintenanceCostLKR);
    e.partsCostLKR = Math.round(e.partsCostLKR);
    e.laborCostLKR = Math.round(e.laborCostLKR);
    e.contractorCostLKR = Math.round(e.contractorCostLKR);
    e.productionHoursLost = Number(e.productionHoursLost.toFixed(1));
  });

  return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
}

// ---------------------------------------------------------------------------
// Machine health (derived from breakdowns + work orders)
// ---------------------------------------------------------------------------

type HealthEntry = MachineHealthDoc & {
  _breakdowns: Row[];
  _pmHistory: Row[];
  _machineStatus: unknown;
  _storedHealth: number | null;
};

function mapMachineStatus(status: unknown): MachineHealthDoc['currentStatus'] {
  switch (String(status ?? '')) {
    case 'under_maintenance':
      return 'maintenance';
    case 'decommissioned':
      return 'decommissioned';
    default:
      return 'operational';
  }
}

// Machines are scoped by siteId, not companyId, so resolve the current user's
// sites to fetch the real machine records (health score, service dates, etc.).
async function fetchMachinesForSites(): Promise<Row[]> {
  const profile = useAuthStore.getState().userProfile;
  // Machines created by users with no explicit site are stored with
  // siteId = companyId, so always include the company id as a fallback site.
  const siteIds = [...new Set([...(profile?.siteIds ?? []), profile?.companyId ?? ''])].filter(Boolean);
  if (siteIds.length === 0) return [];
  const rows: Row[] = [];
  for (let i = 0; i < siteIds.length; i += 10) {
    const chunk = siteIds.slice(i, i + 10);
    try {
      const snap = await getDocs(query(collection(db, 'machines'), where('siteId', 'in', chunk), ...plantConstraints('machines')));
      snap.docs.forEach((d) => rows.push({ id: d.id, ...d.data() }));
      failedSources.delete('machines');
    } catch (err) {
      console.error('Analytics: could not load machines', err);
      failedSources.add('machines');
    }
  }
  return rows;
}

const OPEN_BREAKDOWN_STATUSES = new Set([
  'reported', 'acknowledged', 'triage_in_progress', 'assigned', 'en_route',
  'repair_in_progress', 'on_hold_parts', 'on_hold_approval',
]);
const isOpenBreakdown = (b: Row) => OPEN_BREAKDOWN_STATUSES.has(String(b.status ?? ''));
const isOpenWo = (w: Row) => !isCompletedWoStatus(w.status) && String(w.status ?? '') !== 'CANCELLED';

/**
 * Per-machine health, with the same definitions as the server snapshot
 * (functions/src/machines/machineHealth.js) and the monthly figures:
 *  - healthScore: the score the server computed and stored on the machine
 *    (lib/machineHealth.ts formula); computed here from the same records
 *    only for machines the server hasn't scored yet;
 *  - MTTR: mean reported → sign-off time of breakdowns restored in the last
 *    90 days; MTBF: (90 days − downtime) / failures in that window;
 *  - open counts exclude cancelled records; MTD cost is parts + labour of
 *    work done this month.
 */
export async function computeMachineHealth(companyId: string): Promise<MachineHealthDoc[]> {
  const [breakdowns, workOrders, pmHistory, machineDocs] = await Promise.all([
    fetchAll('breakdown_tickets', companyId),
    fetchAll('workOrders', companyId),
    fetchAll('pm_history', companyId),
    fetchMachinesForSites(),
  ]);

  const now = new Date();
  const monthStr = monthKey(now);
  const windowStart = now.getTime() - HEALTH_WINDOW_DAYS * 86_400_000;
  const machines = new Map<string, HealthEntry>();

  const ensure = (id: string, seed: Row): HealthEntry => {
    let m = machines.get(id);
    if (!m) {
      m = {
        companyId,
        machineId: id,
        machineIdCode: String(id).slice(0, 6).toUpperCase(),
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
        _breakdowns: [],
        _pmHistory: [],
        _machineStatus: null,
        _storedHealth: null,
      };
      machines.set(id, m);
    }
    return m;
  };

  // Seed every known machine with its real record so all machines appear.
  machineDocs.forEach((doc) => {
    const m = ensure(doc.id, {
      machineName: doc.name,
      machineDepartment: doc.department,
      machineLocation: [doc.floor, doc.bay, doc.station].filter((x) => x != null && x !== '').join(' · '),
    });
    m._machineStatus = doc.status;
    m.currentStatus = mapMachineStatus(doc.status);
    // Server-computed score (it stamps healthScoreUpdatedAt); older,
    // hand-set values are recomputed below instead.
    m._storedHealth = doc.healthScoreUpdatedAt && typeof doc.healthScore === 'number' ? doc.healthScore : null;
    m.lastServiceDate = (doc.lastServiceDate as Timestamp) ?? null;
    m.nextPmDue = (doc.nextPmDue as Timestamp) ?? null;
  });

  breakdowns.forEach((b) => {
    if (isCancelledBreakdown(b)) return;
    const id = String(b.machineId ?? b.machineName ?? 'unknown');
    const m = ensure(id, b);
    m._breakdowns.push(b);
    const opened = toDate(b.reportedAt ?? b.createdAt);
    if (opened) {
      if (monthKey(opened) === monthStr) m.breakdownCountMTD += 1;
      if (!m.lastBreakdownDate || opened > toDate(m.lastBreakdownDate)!) {
        m.lastBreakdownDate = Timestamp.fromDate(opened);
      }
    }
    if (isOpenBreakdown(b)) m.openBreakdownCount += 1;
  });

  pmHistory.forEach((p) => {
    const m = p.machineId != null ? machines.get(String(p.machineId)) : undefined;
    if (m) m._pmHistory.push(p);
  });

  const woByMachine = new Map<string, Row[]>();
  workOrders.forEach((w) => {
    const id = String(w.machineId ?? '');
    if (!id) return;
    const m = machines.get(id);
    if (!m) return;
    woByMachine.set(id, [...(woByMachine.get(id) ?? []), w]);
    if (isOpenWo(w)) m.openWoCount += 1;
    const done = woDoneAt(w);
    if (isCompletedWoStatus(w.status) && done && monthKey(done) === monthStr) m.maintenanceCostMTD += woCost(w);
  });

  return Array.from(machines.values()).map((m) => {
    const events = computeDowntimeEvents(m._breakdowns, woByMachine.get(m.machineId) ?? [], now, breakdownDowntimeHours)
      .filter((e) => {
        const at = toDate(e.anchor);
        return !!at && at.getTime() >= windowStart;
      });
    const restored = events.filter((e) => e.kind === 'breakdown' && !e.ongoing).map((e) => e.hours);
    const mttrHours = restored.length ? restored.reduce((a, c) => a + c, 0) / restored.length : 0;
    const failures = m._breakdowns.filter((b) => {
      const d = toDate(b.reportedAt ?? b.createdAt);
      return !!d && d.getTime() >= windowStart;
    }).length;
    const mtbf = mtbfDays(
      new Map([[m.machineId, failures]]),
      new Map([[m.machineId, sumDowntimeHours(events)]]),
      HEALTH_WINDOW_DAYS * 24,
    );
    const healthScore = m._storedHealth ?? machineHealthScoreFromRecords(m._machineStatus, m._breakdowns, m._pmHistory, now);
    const currentStatus = m.currentStatus === 'decommissioned'
      ? 'decommissioned'
      : m.openBreakdownCount > 0 ? 'breakdown' : m.currentStatus;
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
      currentStatus,
      healthScore: Math.max(0, Math.min(100, healthScore)),
      mtbfDays: Number(mtbf.toFixed(1)),
      mttrHours: Number(mttrHours.toFixed(2)),
      lastBreakdownDate: m.lastBreakdownDate,
      lastServiceDate: m.lastServiceDate,
      nextPmDue: m.nextPmDue,
      openBreakdownCount: m.openBreakdownCount,
      openWoCount: m.openWoCount,
      breakdownCountMTD: m.breakdownCountMTD,
      maintenanceCostMTD: Math.round(m.maintenanceCostMTD),
      watchFlag: watchFlagLevel !== null,
      watchFlagLevel: watchFlagLevel as MachineHealthDoc['watchFlagLevel'],
      updatedAt: Timestamp.now(),
    };
  });
}

// ---------------------------------------------------------------------------
// Plant efficiency (Analytics → Plant efficiency tab)
// ---------------------------------------------------------------------------

export interface PlantEfficiencyFigures {
  /** Work-order parts + labour, plus contractor invoices. */
  maintenanceCost: number;
  /** Unplanned WO repair time + downtime recorded on breakdown tickets. */
  downtimeHours: number;
  /** Downtime hours × each machine's configured Downtime Cost rate. */
  downtimeCost: number;
  breakdowns: number;
  workOrders: number;
}

export interface PlantEfficiencyMonth extends PlantEfficiencyFigures {
  month: string;
}

export interface PlantEfficiency {
  /** null = records whose machine has no plant assigned. */
  plantId: string | null;
  totals: PlantEfficiencyFigures;
  months: PlantEfficiencyMonth[];
  machineCount: number;
  /** Average machine health score (0–100) of the plant's machines, null when it has none. */
  healthScore: number | null;
}

const emptyFigures = (): PlantEfficiencyFigures => ({
  maintenanceCost: 0, downtimeHours: 0, downtimeCost: 0, breakdowns: 0, workOrders: 0,
});

/**
 * Per-plant maintenance efficiency over the given months, using the same
 * cost / downtime rules as the monthly analytics: maintenance cost (WO parts
 * + labour + contractor invoices), downtime hours and cost, breakdown and
 * work-order counts per month, and the average machine health score.
 * Records are attributed to a plant by their denormalized
 * machinePlantId/plantId or, failing that, their machine's plant.
 */
export async function computePlantEfficiency(companyId: string, months: string[]): Promise<PlantEfficiency[]> {
  const [breakdowns, workOrders, contractorJobs, machines, health] = await Promise.all([
    fetchAll('breakdown_tickets', companyId),
    fetchAll('workOrders', companyId),
    fetchAll('contractorJobs', companyId),
    fetchMachines(companyId),
    computeMachineHealth(companyId).catch(() => [] as MachineHealthDoc[]),
  ]);

  const machinePlant = new Map<string, string | null>();
  const machineRate = new Map<string, number>();
  machines.forEach((m) => {
    machinePlant.set(String(m.id), m.plantId ?? null);
    const rate = computeEffectiveCostPerHour(m.costPerHourDown ?? null, m.unitsPerHour ?? null, m.unitValue ?? null);
    if (rate !== null) machineRate.set(String(m.id), rate);
  });
  const plantOf = (row: Row): string | null => {
    const p = row.machinePlantId ?? row.plantId;
    if (p) return String(p);
    return row.machineId != null ? machinePlant.get(String(row.machineId)) ?? null : null;
  };

  const monthSet = new Set(months);
  const byPlant = new Map<string, PlantEfficiency>();
  const KEY_NONE = '__none__';
  const ensure = (plantId: string | null): PlantEfficiency => {
    const key = plantId ?? KEY_NONE;
    let p = byPlant.get(key);
    if (!p) {
      p = {
        plantId,
        totals: emptyFigures(),
        months: months.map((month) => ({ month, ...emptyFigures() })),
        machineCount: 0,
        healthScore: null,
      };
      byPlant.set(key, p);
    }
    return p;
  };
  const add = (row: Row, when: unknown, apply: (f: PlantEfficiencyFigures) => void) => {
    const d = toDate(when);
    if (!d) return;
    const mk = monthKey(d);
    if (!monthSet.has(mk)) return;
    const p = ensure(plantOf(row));
    apply(p.totals);
    const m = p.months.find((x) => x.month === mk);
    if (m) apply(m);
  };
  const downtimeCostFor = (row: Row, hours: number) => {
    const rate = row.machineId != null ? machineRate.get(String(row.machineId)) : undefined;
    return rate !== undefined ? hours * rate : 0;
  };

  breakdowns.forEach((b) => {
    if (isCancelledBreakdown(b)) return;
    add(b, b.reportedAt ?? b.createdAt, (f) => { f.breakdowns += 1; });
  });
  computeDowntimeEvents(breakdowns, workOrders, new Date(), breakdownDowntimeHours).forEach((e) => {
    add(e.row, e.anchor, (f) => {
      f.downtimeHours += e.hours;
      f.downtimeCost += downtimeCostFor(e.row, e.hours);
    });
  });
  workOrders.forEach((w) => {
    if (String(w.status ?? '') === 'CANCELLED') return;
    // Count work orders by when they were raised…
    add(w, w.createdAt, (f) => { f.workOrders += 1; });
    // …and cost by when the work was done, as monthly analytics does.
    add(w, woDoneAt(w) ?? w.createdAt, (f) => {
      f.maintenanceCost += woCost(w);
    });
  });
  // Contractor cost when the work was done; cancelled jobs cost nothing.
  contractorJobs.forEach((c) => {
    if (!isCountableContractorJob(c)) return;
    add(c, contractorJobCostDate(c), (f) => {
      f.maintenanceCost += contractorJobCost(c);
    });
  });

  // Machine counts and health, including plants with no activity this period.
  const healthByMachine = new Map(health.map((h) => [String(h.machineId), h.healthScore]));
  const scores = new Map<string, number[]>();
  machines.forEach((m) => {
    const p = ensure(m.plantId ?? null);
    p.machineCount += 1;
    const s = healthByMachine.get(String(m.id));
    if (typeof s === 'number') {
      const key = m.plantId ?? KEY_NONE;
      scores.set(key, [...(scores.get(key) ?? []), s]);
    }
  });
  byPlant.forEach((p, key) => {
    const list = scores.get(key);
    if (list?.length) p.healthScore = Math.round(list.reduce((a, b) => a + b, 0) / list.length);
    const round = (f: PlantEfficiencyFigures) => {
      f.maintenanceCost = Math.round(f.maintenanceCost);
      f.downtimeCost = Math.round(f.downtimeCost);
      f.downtimeHours = Number(f.downtimeHours.toFixed(1));
    };
    round(p.totals);
    p.months.forEach(round);
  });

  return [...byPlant.values()];
}
