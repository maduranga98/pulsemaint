import {
  collection,
  doc,
  addDoc,
  getDocs,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  setDoc,
  getDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import type {
  OEERecord,
  BigLoss,
  BigLossCategory,
  OEETarget,
  OEEMonthlyAggregate,
  OEEShift,
} from '../types/oee.types';
import { BIG_LOSS_META } from '../types/oee.types';

// ─── Pure Calculations ────────────────────────────────────────────────────────

export function calculateAvailability(planned: number, downtime: number): number {
  if (planned <= 0) return 0;
  const val = ((planned - downtime) / planned) * 100;
  return Math.round(Math.min(100, Math.max(0, val)) * 10) / 10;
}

export function calculatePerformance(actual: number, target: number): number {
  if (target <= 0) return 0;
  const val = (actual / target) * 100;
  return Math.round(Math.min(100, Math.max(0, val)) * 10) / 10;
}

export function calculateQuality(good: number, total: number): number {
  if (total <= 0) return 0;
  const val = (good / total) * 100;
  return Math.round(Math.min(100, Math.max(0, val)) * 10) / 10;
}

export function calculateOEE(availability: number, performance: number, quality: number): number {
  const val = (availability / 100) * (performance / 100) * (quality / 100) * 100;
  return Math.round(val * 10) / 10;
}

export function calculateLossCost(hours: number, productionValuePerHour: number): number {
  return Math.round(hours * productionValuePerHour);
}

export function calculateBigLosses(
  oeeRecords: OEERecord[],
  lkrPerHour = 0
): BigLoss[] {
  if (oeeRecords.length === 0) return buildEmptyLosses();

  const totalPlannedHours = oeeRecords.reduce((s, r) => s + r.plannedProductionTime / 60, 0);

  // Breakdown: sum actual downtime from records
  const breakdownHours = oeeRecords.reduce((s, r) => s + r.actualDowntime / 60, 0);

  // Performance loss: hours lost due to speed
  const performanceLostHours = oeeRecords.reduce((r, rec) => {
    const availHours = (rec.plannedProductionTime - rec.actualDowntime) / 60;
    const speedLoss = availHours * (1 - rec.performance / 100);
    return r + speedLoss;
  }, 0);

  // Quality loss: hours equivalent of rejected output
  const qualityLostHours = oeeRecords.reduce((r, rec) => {
    const availHours = (rec.plannedProductionTime - rec.actualDowntime) / 60;
    const qualLoss = availHours * (rec.performance / 100) * (1 - rec.quality / 100);
    return r + qualLoss;
  }, 0);

  // Heuristic splits — in production these should come from tagged data
  const setupHours = breakdownHours * 0.3;
  const minorHours = performanceLostHours * 0.4;
  const reducedHours = performanceLostHours * 0.6;
  const startupHours = qualityLostHours * 0.35;
  const productionHours = qualityLostHours * 0.65;

  const categories: { cat: BigLossCategory; hours: number }[] = [
    { cat: 'breakdown', hours: breakdownHours - setupHours },
    { cat: 'setup', hours: setupHours },
    { cat: 'minor_stoppage', hours: minorHours },
    { cat: 'reduced_speed', hours: reducedHours },
    { cat: 'startup_rejects', hours: startupHours },
    { cat: 'production_rejects', hours: productionHours },
  ];

  return categories.map(({ cat, hours }) => ({
    category: cat,
    label: BIG_LOSS_META[cat].label,
    hours: Math.round(hours * 10) / 10,
    percentage: totalPlannedHours > 0 ? Math.round((hours / totalPlannedHours) * 1000) / 10 : 0,
    lkrCost: calculateLossCost(hours, lkrPerHour),
    color: BIG_LOSS_META[cat].color,
  }));

  function buildEmptyLosses(): BigLoss[] {
    return (Object.keys(BIG_LOSS_META) as BigLossCategory[]).map((cat) => ({
      category: cat,
      label: BIG_LOSS_META[cat].label,
      hours: 0,
      percentage: 0,
      lkrCost: 0,
      color: BIG_LOSS_META[cat].color,
    }));
  }
}

// ─── Firestore: Save OEE Record ───────────────────────────────────────────────

export async function saveOEERecord(
  plantId: string,
  record: Omit<OEERecord, 'id' | 'enteredAt'>
): Promise<string> {
  const ref = collection(db, 'oee_records', plantId, 'records');
  const docRef = await addDoc(ref, {
    ...record,
    enteredAt: serverTimestamp(),
  });

  await updateMonthlyAggregate(plantId, record.machineId, record.shiftDate.slice(0, 7));
  return docRef.id;
}

// ─── Firestore: Subscribe OEE Records for Machine ────────────────────────────

export function subscribeOEERecords(
  plantId: string,
  machineId: string,
  limitCount: number,
  callback: (records: OEERecord[]) => void,
  onError: (e: Error) => void
): () => void {
  const q = query(
    collection(db, 'oee_records', plantId, 'records'),
    where('machineId', '==', machineId),
    orderBy('shiftDate', 'desc'),
    orderBy('shift', 'desc'),
    limit(limitCount)
  );

  return onSnapshot(
    q,
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() } as OEERecord))),
    onError
  );
}

// ─── Firestore: Subscribe All Machines Latest OEE ────────────────────────────

export function subscribeAllLatestOEE(
  plantId: string,
  callback: (records: OEERecord[]) => void,
  onError: (e: Error) => void
): () => void {
  const q = query(
    collection(db, 'oee_records', plantId, 'records'),
    orderBy('shiftDate', 'desc'),
    limit(200)
  );

  return onSnapshot(
    q,
    (snap) => {
      const all = snap.docs.map((d) => ({ id: d.id, ...d.data() } as OEERecord));
      // Keep only the latest record per machine
      const latest = new Map<string, OEERecord>();
      for (const r of all) {
        if (!latest.has(r.machineId)) {
          latest.set(r.machineId, r);
        }
      }
      callback(Array.from(latest.values()));
    },
    onError
  );
}

// ─── Firestore: Monthly Aggregate ────────────────────────────────────────────

async function updateMonthlyAggregate(plantId: string, machineId: string, month: string) {
  const recordsSnap = await getDocs(
    query(
      collection(db, 'oee_records', plantId, 'records'),
      where('machineId', '==', machineId),
      where('shiftDate', '>=', `${month}-01`),
      where('shiftDate', '<=', `${month}-31`)
    )
  );

  const records = recordsSnap.docs.map((d) => d.data() as OEERecord);
  if (records.length === 0) return;

  const avg = (key: keyof OEERecord) =>
    Math.round((records.reduce((s, r) => s + (r[key] as number), 0) / records.length) * 10) / 10;

  const aggregate: OEEMonthlyAggregate = {
    month,
    avgOEE: avg('oee'),
    avgAvailability: avg('availability'),
    avgPerformance: avg('performance'),
    avgQuality: avg('quality'),
    recordCount: records.length,
  };

  await setDoc(
    doc(db, 'oee_trends', plantId, 'machines', machineId, 'monthly', month),
    aggregate,
    { merge: true }
  );
}

export async function fetchOEEMonthlyTrend(
  plantId: string,
  machineId: string,
  months = 12
): Promise<OEEMonthlyAggregate[]> {
  const q = query(
    collection(db, 'oee_trends', plantId, 'machines', machineId, 'monthly'),
    orderBy('month', 'desc'),
    limit(months)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as OEEMonthlyAggregate).reverse();
}

// ─── Firestore: OEE Targets ───────────────────────────────────────────────────

export async function fetchOEETarget(plantId: string, machineId: string): Promise<OEETarget | null> {
  const ref = doc(db, 'oee_targets', plantId, 'machines', machineId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return snap.data() as OEETarget;
}

export async function saveOEETarget(plantId: string, target: OEETarget): Promise<void> {
  const ref = doc(db, 'oee_targets', plantId, 'machines', target.machineId);
  await setDoc(ref, target, { merge: true });
}

// ─── Factory Pro: Auto-feed Downtime ─────────────────────────────────────────

export async function autoFeedDowntime(
  plantId: string,
  machineId: string,
  shiftDate: string,
  shift: OEEShift
): Promise<{ totalMinutes: number; linkedIds: string[] }> {
  // Query completed breakdown work orders for this machine and shift
  const q = query(
    collection(db, 'work_orders'),
    where('companyId', '==', plantId),
    where('machineId', '==', machineId),
    where('status', '==', 'completed'),
    where('shiftDate', '==', shiftDate),
    where('shift', '==', shift)
  );

  const snap = await getDocs(q);
  let totalMinutes = 0;
  const linkedIds: string[] = [];

  for (const d of snap.docs) {
    const wo = d.data();
    const duration = (wo.actualRepairDuration as number) ?? 0;
    totalMinutes += duration;
    linkedIds.push(d.id);
  }

  return { totalMinutes, linkedIds };
}

// ─── Fetch Range Records ──────────────────────────────────────────────────────

export async function fetchOEERecordsByDateRange(
  plantId: string,
  machineId: string,
  startDate: string,
  endDate: string
): Promise<OEERecord[]> {
  const q = query(
    collection(db, 'oee_records', plantId, 'records'),
    where('machineId', '==', machineId),
    where('shiftDate', '>=', startDate),
    where('shiftDate', '<=', endDate),
    orderBy('shiftDate', 'asc')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as OEERecord));
}

export async function fetchOEERecordsByMonth(
  plantId: string,
  month: string // YYYY-MM
): Promise<OEERecord[]> {
  const q = query(
    collection(db, 'oee_records', plantId, 'records'),
    where('shiftDate', '>=', `${month}-01`),
    where('shiftDate', '<=', `${month}-31`),
    orderBy('shiftDate', 'asc')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as OEERecord));
}

// ─── Shift Comparison ────────────────────────────────────────────────────────

export async function fetchShiftComparison(
  plantId: string,
  machineId: string,
  months: number
): Promise<{ shift: OEEShift; avgOEE: number; avgAvailability: number; avgPerformance: number; avgQuality: number; recordCount: number }[]> {
  const start = new Date();
  start.setMonth(start.getMonth() - months);
  const startDate = start.toISOString().slice(0, 10);

  const q = query(
    collection(db, 'oee_records', plantId, 'records'),
    where('machineId', '==', machineId),
    where('shiftDate', '>=', startDate),
    orderBy('shiftDate', 'asc')
  );

  const snap = await getDocs(q);
  const records = snap.docs.map((d) => d.data() as OEERecord);

  const byShift = new Map<OEEShift, OEERecord[]>([
    ['day', []],
    ['evening', []],
    ['night', []],
  ]);

  for (const r of records) {
    byShift.get(r.shift)?.push(r);
  }

  return (['day', 'evening', 'night'] as OEEShift[]).map((shift) => {
    const recs = byShift.get(shift) ?? [];
    if (recs.length === 0) return { shift, avgOEE: 0, avgAvailability: 0, avgPerformance: 0, avgQuality: 0, recordCount: 0 };
    const avg = (key: keyof OEERecord) =>
      Math.round((recs.reduce((s, r) => s + (r[key] as number), 0) / recs.length) * 10) / 10;
    return {
      shift,
      avgOEE: avg('oee'),
      avgAvailability: avg('availability'),
      avgPerformance: avg('performance'),
      avgQuality: avg('quality'),
      recordCount: recs.length,
    };
  });
}
