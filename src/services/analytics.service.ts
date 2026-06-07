import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  onSnapshot,
  doc,
  getDoc,
  limit,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import {
  computeDailyAnalytics,
  computeMonthlyAnalytics,
  computeMachineHealth,
} from './analyticsAggregation';
import type {
  AnalyticsDaily,
  AnalyticsMonthly,
  MachineHealthDoc,
  TechnicianStatusDoc,
  DashboardNotification,
} from '../types/analytics.types';

const currentMonthKey = () => new Date().toISOString().slice(0, 7);

// ---------------------------------------------------------------------------
// Daily Analytics
// ---------------------------------------------------------------------------

export async function fetchDailyAnalytics(
  companyId: string,
  fromDate: string,
  toDate: string,
): Promise<AnalyticsDaily[]> {
  const q = query(
    collection(db, 'analytics_daily'),
    where('companyId', '==', companyId),
    where('date', '>=', fromDate),
    where('date', '<=', toDate),
    orderBy('date', 'asc'),
  );
  const snap = await getDocs(q);
  if (snap.empty) {
    // No pre-aggregated data — compute it from raw collections.
    return computeDailyAnalytics(companyId, fromDate, toDate);
  }
  return snap.docs.map((d) => ({ ...d.data(), id: d.id } as unknown as AnalyticsDaily));
}

// ---------------------------------------------------------------------------
// Monthly Analytics
// ---------------------------------------------------------------------------

export async function fetchMonthlyAnalytics(
  companyId: string,
  month: string,
): Promise<AnalyticsMonthly | null> {
  const ref = doc(db, 'analytics_monthly', `${companyId}_${month}`);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    // No pre-aggregated doc — compute it from raw collections.
    return computeMonthlyAnalytics(companyId, month);
  }
  return { ...snap.data(), id: snap.id } as unknown as AnalyticsMonthly;
}

export async function fetchLatestMonthlyAnalytics(companyId: string): Promise<AnalyticsMonthly | null> {
  const q = query(
    collection(db, 'analytics_monthly'),
    where('companyId', '==', companyId),
    orderBy('month', 'desc'),
    limit(1),
  );
  const snap = await getDocs(q);
  if (snap.empty) return computeMonthlyAnalytics(companyId, currentMonthKey());
  return { ...snap.docs[0].data(), id: snap.docs[0].id } as unknown as AnalyticsMonthly;
}

// ---------------------------------------------------------------------------
// Machine Health
// ---------------------------------------------------------------------------

export async function fetchMachineHealth(companyId: string): Promise<MachineHealthDoc[]> {
  const q = query(
    collection(db, 'machine_health'),
    where('companyId', '==', companyId),
  );
  const snap = await getDocs(q);
  if (snap.empty) return computeMachineHealth(companyId);
  return snap.docs.map((d) => ({ ...d.data(), id: d.id } as unknown as MachineHealthDoc));
}

export function subscribeMachineHealth(
  companyId: string,
  callback: (data: MachineHealthDoc[]) => void,
) {
  const q = query(
    collection(db, 'machine_health'),
    where('companyId', '==', companyId),
  );
  return onSnapshot(q, (snap) => {
    if (snap.empty) {
      computeMachineHealth(companyId).then(callback).catch(() => callback([]));
      return;
    }
    const data = snap.docs.map((d) => ({ ...d.data(), id: d.id } as unknown as MachineHealthDoc));
    callback(data);
  });
}

// ---------------------------------------------------------------------------
// Technician Status
// ---------------------------------------------------------------------------

export function subscribeTechnicianStatuses(
  companyId: string,
  callback: (data: TechnicianStatusDoc[]) => void,
) {
  const q = query(
    collection(db, 'technician_status'),
    where('companyId', '==', companyId),
  );
  return onSnapshot(q, (snap) => {
    const data = snap.docs.map((d) => ({ ...d.data(), id: d.id } as unknown as TechnicianStatusDoc));
    callback(data);
  });
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

export function subscribeNotifications(
  companyId: string,
  callback: (data: DashboardNotification[]) => void,
) {
  const q = query(
    collection(db, 'notifications'),
    where('companyId', '==', companyId),
    orderBy('timestamp', 'desc'),
    limit(50),
  );
  return onSnapshot(q, (snap) => {
    const data = snap.docs.map((d) => ({ ...d.data(), id: d.id } as unknown as DashboardNotification));
    callback(data);
  });
}

// ---------------------------------------------------------------------------
// Breakdown tickets — live counts
// ---------------------------------------------------------------------------

export function subscribeActiveBreakdownCount(
  companyId: string,
  callback: (count: number) => void,
) {
  const q = query(
    collection(db, 'breakdown_tickets'),
    where('companyId', '==', companyId),
    where('status', 'not-in', ['closed', 'resolved']),
  );
  return onSnapshot(q, (snap) => callback(snap.size));
}

export function subscribeOpenWorkOrderCount(
  companyId: string,
  callback: (count: number) => void,
) {
  const q = query(
    collection(db, 'workOrders'),
    where('companyId', '==', companyId),
    where('status', 'in', ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'ON_HOLD_PARTS', 'ON_HOLD_APPROVAL']),
  );
  return onSnapshot(q, (snap) => callback(snap.size));
}

// ---------------------------------------------------------------------------
// Date range helpers for analytics queries
// ---------------------------------------------------------------------------

export function getDateRange(range: '7D' | '30D' | '3M' | '6M' | '12M'): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  switch (range) {
    case '7D':
      from.setDate(to.getDate() - 7);
      break;
    case '30D':
      from.setDate(to.getDate() - 30);
      break;
    case '3M':
      from.setMonth(to.getMonth() - 3);
      break;
    case '6M':
      from.setMonth(to.getMonth() - 6);
      break;
    case '12M':
      from.setMonth(to.getMonth() - 12);
      break;
  }
  const fmt = (d: Date) => d.toISOString().split('T')[0];
  return { from: fmt(from), to: fmt(to) };
}
