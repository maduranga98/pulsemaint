import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  limit,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import {
  computeDailyAnalytics,
  computeMonthlyAnalytics,
  computeMachineHealth,
  monthKey,
  dateKey,
  type MonthArg,
} from './analyticsAggregation';
import type {
  AnalyticsDaily,
  AnalyticsMonthly,
  MachineHealthDoc,
  TechnicianStatusDoc,
  DashboardNotification,
} from '../types/analytics.types';

const currentMonthKey = () => monthKey(new Date());

// Every figure is computed live from the operational records. The
// pre-aggregated analytics_daily / analytics_monthly / machine_health
// documents used to win when present, and the old jobs that wrote them stored
// 0 for cost, PM compliance and hours lost (machine_health only covered
// machines that had a breakdown) — so "All Plants" showed zeros while a single
// plant showed real figures. analytics_monthly / machine_health are now
// written with these same definitions, for scheduled reports only.

// ---------------------------------------------------------------------------
// Daily Analytics
// ---------------------------------------------------------------------------

export async function fetchDailyAnalytics(
  companyId: string,
  fromDate: string,
  toDate: string,
  plantId: string | null = null,
): Promise<AnalyticsDaily[]> {
  return computeDailyAnalytics(companyId, fromDate, toDate, plantId);
}

// ---------------------------------------------------------------------------
// Monthly Analytics
// ---------------------------------------------------------------------------

export async function fetchMonthlyAnalytics(
  companyId: string,
  month: MonthArg,
  plantId: string | null = null,
): Promise<AnalyticsMonthly | null> {
  return computeMonthlyAnalytics(companyId, month, plantId);
}

export async function fetchLatestMonthlyAnalytics(companyId: string): Promise<AnalyticsMonthly | null> {
  return computeMonthlyAnalytics(companyId, currentMonthKey());
}

// ---------------------------------------------------------------------------
// Machine Health
// ---------------------------------------------------------------------------

export async function fetchMachineHealth(companyId: string): Promise<MachineHealthDoc[]> {
  return computeMachineHealth(companyId);
}

export function subscribeMachineHealth(
  companyId: string,
  callback: (data: MachineHealthDoc[]) => void,
) {
  let active = true;
  computeMachineHealth(companyId)
    .then((data) => active && callback(data))
    .catch(() => active && callback([]));
  return () => {
    active = false;
  };
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
  // status filtered client-side — `not-in` + equality requires a composite
  // index that isn't deployed.
  const q = query(
    collection(db, 'breakdown_tickets'),
    where('companyId', '==', companyId),
  );
  return onSnapshot(q, (snap) => {
    const closed = new Set(['closed', 'resolved', 'cancelled']);
    callback(snap.docs.filter((d) => !closed.has(String(d.data().status))).length);
  });
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
  // Local calendar days, the same keys the daily analytics bucket by.
  return { from: dateKey(from), to: dateKey(to) };
}
