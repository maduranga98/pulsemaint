import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  setDoc,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import type { Machine, MachineCriticality } from '../../../types/machine';
import type { Breakdown } from '../../../types/breakdown';
import { getEffectivePMHistoryStatus } from '../../../utils/pm.utils';
import type {
  MoeConfig,
  MoeMachineSummary,
  MoePlantAggregate,
  MoeTrendPoint,
} from '../types/moe.types';
import { DEFAULT_MOE_CONFIG, getMoeStatus } from '../types/moe.types';

// ─── Config ────────────────────────────────────────────────────────────────

export async function fetchMoeConfig(siteId: string): Promise<MoeConfig> {
  const ref = doc(db, 'moeConfig', siteId);
  const snap = await getDoc(ref);
  if (snap.exists()) return snap.data() as MoeConfig;
  return { siteId, ...DEFAULT_MOE_CONFIG };
}

export async function saveMoeConfig(config: MoeConfig): Promise<void> {
  const sum =
    config.weights.availability +
    config.weights.maintenanceCompliance +
    config.weights.reliability +
    config.weights.health;
  if (Math.abs(sum - 1) > 0.005) {
    throw new Error('MOE weights must sum to 1.0');
  }
  const ref = doc(db, 'moeConfig', config.siteId);
  await setDoc(ref, { ...config, updatedAt: Timestamp.now() }, { merge: true });
}

// ─── Pure calculation helpers ────────────────────────────────────────────────

export function calculateAvailabilityScore(periodMinutes: number, downtimeMinutes: number): number {
  if (periodMinutes <= 0) return 100;
  const val = ((periodMinutes - downtimeMinutes) / periodMinutes) * 100;
  return Math.round(Math.min(100, Math.max(0, val)) * 10) / 10;
}

export function calculateReliabilityScore(breakdownCount: number, penaltyFactor: number): number {
  const val = 100 - breakdownCount * penaltyFactor;
  return Math.round(Math.min(100, Math.max(0, val)) * 10) / 10;
}

export function calculateMaintenanceComplianceScore(
  scheduledCount: number,
  completedOnTimeCount: number,
): number {
  if (scheduledCount <= 0) return 100;
  const val = (completedOnTimeCount / scheduledCount) * 100;
  return Math.round(Math.min(100, Math.max(0, val)) * 10) / 10;
}

export function calculateMoeScore(
  scores: {
    availabilityScore: number;
    maintenanceComplianceScore: number;
    reliabilityScore: number;
    healthScore: number;
  },
  weights: MoeConfig['weights'],
): number {
  const val =
    scores.availabilityScore * weights.availability +
    scores.maintenanceComplianceScore * weights.maintenanceCompliance +
    scores.reliabilityScore * weights.reliability +
    scores.healthScore * weights.health;
  return Math.round(Math.min(100, Math.max(0, val)) * 10) / 10;
}

// ─── Data fetch helpers ──────────────────────────────────────────────────────

async function fetchActiveMachines(siteId: string): Promise<Machine[]> {
  const q = query(collection(db, 'machines'), where('siteId', '==', siteId));
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() } as Machine))
    .filter((m) => m.status !== 'decommissioned');
}

function tsToDate(v: unknown): Date | null {
  const t = v as Timestamp | undefined;
  return t && typeof t.toDate === 'function' ? t.toDate() : null;
}

function overlapMinutes(aStart: Date, aEnd: Date, bStart: Date | null, bEnd: Date | null): number {
  if (!bStart) return 0;
  const end = bEnd ?? new Date();
  const start = Math.max(aStart.getTime(), bStart.getTime());
  const finish = Math.min(aEnd.getTime(), end.getTime());
  if (finish <= start) return 0;
  return (finish - start) / 60000;
}

async function fetchBreakdownStatsForSite(
  siteId: string,
  start: Date,
  end: Date,
): Promise<Map<string, { count: number; downtimeMinutes: number }>> {
  const q = query(collection(db, 'breakdown_tickets'), where('siteId', '==', siteId));
  const snap = await getDocs(q);
  const byMachine = new Map<string, { count: number; downtimeMinutes: number }>();

  snap.docs.forEach((d) => {
    const b = d.data() as Breakdown;
    const reportedAt = tsToDate(b.reportedAt);
    if (!reportedAt || reportedAt < start || reportedAt > end) return;
    const machineId = String((b as unknown as { machineId?: string }).machineId ?? '');
    if (!machineId) return;
    const resolvedAt = tsToDate((b as unknown as { resolvedAt?: unknown }).resolvedAt);
    const minutes = overlapMinutes(start, end, reportedAt, resolvedAt);
    const prev = byMachine.get(machineId) ?? { count: 0, downtimeMinutes: 0 };
    prev.count += 1;
    prev.downtimeMinutes += minutes;
    byMachine.set(machineId, prev);
  });

  return byMachine;
}

async function fetchPmStatsForSite(
  siteId: string,
  start: Date,
  end: Date,
): Promise<Map<string, { scheduled: number; onTime: number }>> {
  // pm_history docs use `companyId` for tenant scoping (same value as siteId).
  const q = query(collection(db, 'pm_history'), where('companyId', '==', siteId));
  const snap = await getDocs(q);
  const byMachine = new Map<string, { scheduled: number; onTime: number }>();

  snap.docs.forEach((d) => {
    const p = d.data() as Record<string, unknown>;
    const dueDate = tsToDate(p.dueDate);
    if (!dueDate || dueDate < start || dueDate > end) return;
    const machineId = String(p.machineId ?? '');
    if (!machineId) return;
    const effectiveStatus = getEffectivePMHistoryStatus(
      p as { status?: string; dueDate?: unknown; completedDate?: unknown },
    );
    if (effectiveStatus === 'in_progress') return; // not yet relevant
    const prev = byMachine.get(machineId) ?? { scheduled: 0, onTime: 0 };
    prev.scheduled += 1;
    if (effectiveStatus === 'completed_on_time') prev.onTime += 1;
    byMachine.set(machineId, prev);
  });

  return byMachine;
}

/**
 * Computes MOE summaries for every active machine at a site over [start, end],
 * entirely client-side from operational collections. Mirrors the
 * client-side-analytics-computation pattern used elsewhere in the app so the
 * dashboard works without any Cloud Function / pre-aggregation dependency.
 */
export async function computeMoeSummaries(
  siteId: string,
  start: Date,
  end: Date,
  config?: MoeConfig,
): Promise<MoeMachineSummary[]> {
  const cfg = config ?? (await fetchMoeConfig(siteId));
  const periodMinutes = Math.max(1, (end.getTime() - start.getTime()) / 60000);

  const [machines, breakdownStats, pmStats] = await Promise.all([
    fetchActiveMachines(siteId),
    fetchBreakdownStatsForSite(siteId, start, end),
    fetchPmStatsForSite(siteId, start, end),
  ]);

  return machines.map((m) => {
    const bd = breakdownStats.get(m.id) ?? { count: 0, downtimeMinutes: 0 };
    const pm = pmStats.get(m.id) ?? { scheduled: 0, onTime: 0 };

    const availabilityScore = calculateAvailabilityScore(periodMinutes, bd.downtimeMinutes);
    const maintenanceComplianceScore = calculateMaintenanceComplianceScore(pm.scheduled, pm.onTime);
    const reliabilityScore = calculateReliabilityScore(bd.count, cfg.reliabilityPenaltyFactor);
    const healthScore = m.healthScore ?? 100;

    const moeScore = calculateMoeScore(
      { availabilityScore, maintenanceComplianceScore, reliabilityScore, healthScore },
      cfg.weights,
    );

    const criticality = (m.criticality ?? 1) as MachineCriticality;
    const isCritical = criticality >= 4 && moeScore < cfg.criticalMoeThreshold;

    const summary: MoeMachineSummary = {
      machineId: m.id,
      machineName: m.name,
      department: m.department,
      criticality,
      moeScore,
      availabilityScore,
      maintenanceComplianceScore,
      reliabilityScore,
      healthScore,
      breakdownCount: bd.count,
      totalDowntimeMinutes: Math.round(bd.downtimeMinutes),
      isCritical,
    };
    return summary;
  });
}

export function aggregatePlantMoe(
  machines: MoeMachineSummary[],
  previousMachines: MoeMachineSummary[] | null,
): MoePlantAggregate {
  const totalCriticalityWeight = machines.reduce((s, m) => s + m.criticality, 0);
  const plantAverageMoe =
    totalCriticalityWeight > 0
      ? Math.round(
          (machines.reduce((s, m) => s + m.moeScore * m.criticality, 0) / totalCriticalityWeight) * 10,
        ) / 10
      : 0;

  let previousPeriodMoe: number | null = null;
  if (previousMachines && previousMachines.length > 0) {
    const prevWeight = previousMachines.reduce((s, m) => s + m.criticality, 0);
    previousPeriodMoe =
      prevWeight > 0
        ? Math.round(
            (previousMachines.reduce((s, m) => s + m.moeScore * m.criticality, 0) / prevWeight) * 10,
          ) / 10
        : null;
  }

  let trend: 'up' | 'down' | 'flat' = 'flat';
  if (previousPeriodMoe !== null) {
    if (plantAverageMoe - previousPeriodMoe > 0.5) trend = 'up';
    else if (previousPeriodMoe - plantAverageMoe > 0.5) trend = 'down';
  }

  const sorted = [...machines].sort((a, b) => b.moeScore - a.moeScore);
  const bestMachines = sorted.slice(0, 10);
  const worstMachines = [...sorted].reverse().slice(0, 10);
  const criticalMachines = machines.filter((m) => m.isCritical);

  return {
    plantAverageMoe,
    previousPeriodMoe,
    trend,
    bestMachines,
    worstMachines,
    criticalMachines,
    allMachines: machines,
  };
}

/**
 * Builds a day-by-day MOE trend for a single machine over [start, end] by
 * computing a 1-day-window summary for each day in the range. Capped at 92
 * points (roughly a year weekly / a quarter daily) to keep client reads sane.
 */
export async function fetchMoeTrendForMachine(
  siteId: string,
  machineId: string,
  start: Date,
  end: Date,
  config?: MoeConfig,
): Promise<MoeTrendPoint[]> {
  const cfg = config ?? (await fetchMoeConfig(siteId));
  const days: Date[] = [];
  const cursor = new Date(start);
  cursor.setHours(0, 0, 0, 0);
  while (cursor <= end && days.length < 92) {
    days.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  if (days.length === 0) return [];

  const machineSnap = await getDoc(doc(db, 'machines', machineId));
  const machine = machineSnap.exists() ? (machineSnap.data() as Machine) : null;
  const healthScore = machine?.healthScore ?? 100;

  // Per-day machine-scoped stats are recomputed directly against the raw
  // collections with day-length windows below.
  const bdQ = query(collection(db, 'breakdown_tickets'), where('siteId', '==', siteId), where('machineId', '==', machineId));
  const pmQ = query(collection(db, 'pm_history'), where('companyId', '==', siteId), where('machineId', '==', machineId));
  const [bdSnap, pmSnap] = await Promise.all([getDocs(bdQ), getDocs(pmQ)]);
  const breakdowns = bdSnap.docs.map((d) => d.data() as Breakdown);
  const pms = pmSnap.docs.map((d) => d.data() as Record<string, unknown>);

  return days.map((day) => {
    const dayStart = new Date(day);
    const dayEnd = new Date(day);
    dayEnd.setHours(23, 59, 59, 999);
    const periodMinutes = 24 * 60;

    const dayBreakdowns = breakdowns.filter((b) => {
      const r = tsToDate(b.reportedAt);
      return r && r >= dayStart && r <= dayEnd;
    });
    const downtimeMinutes = dayBreakdowns.reduce(
      (s, b) => s + overlapMinutes(dayStart, dayEnd, tsToDate(b.reportedAt), tsToDate((b as unknown as { resolvedAt?: unknown }).resolvedAt)),
      0,
    );

    const dayPms = pms.filter((p) => {
      const due = tsToDate(p.dueDate);
      return due && due >= dayStart && due <= dayEnd;
    });
    const relevantPms = dayPms.filter((p) => getEffectivePMHistoryStatus(p as never) !== 'in_progress');
    const onTimePms = relevantPms.filter((p) => getEffectivePMHistoryStatus(p as never) === 'completed_on_time');

    const availabilityScore = calculateAvailabilityScore(periodMinutes, downtimeMinutes);
    const maintenanceComplianceScore = calculateMaintenanceComplianceScore(relevantPms.length, onTimePms.length);
    const reliabilityScore = calculateReliabilityScore(dayBreakdowns.length, cfg.reliabilityPenaltyFactor);
    const moeScore = calculateMoeScore(
      { availabilityScore, maintenanceComplianceScore, reliabilityScore, healthScore },
      cfg.weights,
    );

    return {
      date: day.toISOString().slice(0, 10),
      moeScore,
      availabilityScore,
      maintenanceComplianceScore,
      reliabilityScore,
      healthScore,
    };
  });
}

export { getMoeStatus };
