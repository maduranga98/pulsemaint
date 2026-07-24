import type { RecurrenceType, PMOperationalStatus, PMSchedule } from '../types/pm.types';
import { PM_DUE_SOON_DAYS } from '../constants/pmConfig';

// ---------------------------------------------------------------------------
// Next Due Date Calculator
// ---------------------------------------------------------------------------

export function calculateNextDueDate(
  fromDate: Date,
  recurrenceType: RecurrenceType,
  customIntervalDays: number | null,
  seasonalOverride?: boolean,
  peakSeasonStart?: Date | null,
  peakSeasonEnd?: Date | null,
  peakSeasonInterval?: string | null,
): Date {
  const next = new Date(fromDate);

  // Check seasonal override
  if (seasonalOverride && peakSeasonStart && peakSeasonEnd && peakSeasonInterval) {
    const now = new Date();
    if (now >= peakSeasonStart && now <= peakSeasonEnd) {
      // Use peak season interval instead
      return calculateNextDueDate(fromDate, peakSeasonInterval as RecurrenceType, customIntervalDays);
    }
  }

  switch (recurrenceType) {
    case 'daily':
      next.setDate(next.getDate() + 1);
      break;
    case 'weekly':
      next.setDate(next.getDate() + 7);
      break;
    case 'biweekly':
      next.setDate(next.getDate() + 14);
      break;
    case 'monthly':
      next.setMonth(next.getMonth() + 1);
      break;
    case 'quarterly':
      next.setMonth(next.getMonth() + 3);
      break;
    case 'semi_annual':
      next.setMonth(next.getMonth() + 6);
      break;
    case 'annual':
      next.setFullYear(next.getFullYear() + 1);
      break;
    case 'custom':
      if (customIntervalDays && customIntervalDays > 0) {
        next.setDate(next.getDate() + customIntervalDays);
      }
      break;
  }

  return next;
}

// ---------------------------------------------------------------------------
// Compliance Rate Calculator
// ---------------------------------------------------------------------------

export function calculateComplianceRate(
  completedOnTime: number,
  completedLate: number,
  missed: number,
): number {
  const total = completedOnTime + completedLate + missed;
  if (total === 0) return 100;
  return Math.round((completedOnTime / total) * 100);
}

// ---------------------------------------------------------------------------
// Effective PM history status
// ---------------------------------------------------------------------------
// A PM history record is written as `in_progress` when its work order is
// raised and only flips to a completed/missed status once the WO is finished.
// Nothing ever flips a still-open PM to `overdue` when its due date passes, so
// overdue PMs used to disappear from compliance dashboards and analytics. This
// derives the *effective* status at read time: an uncompleted PM whose due date
// has passed counts as overdue.
export function getEffectivePMHistoryStatus(
  record: { status?: string | null; dueDate?: unknown; completedDate?: unknown },
  now: Date = new Date(),
): string {
  const status = record.status ?? '';
  // Terminal / completed states are authoritative — never override them.
  if (status === 'completed_on_time' || status === 'completed_late' || status === 'missed' || status === 'overdue') {
    return status;
  }
  // Only open records (in_progress / scheduled / empty) can become overdue.
  const due = toJsDate(record.dueDate);
  if (due && !toJsDate(record.completedDate) && due.getTime() < now.getTime()) {
    return 'overdue';
  }
  return status || 'in_progress';
}

function toJsDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === 'object') {
    const v = value as { toDate?: () => Date; seconds?: number };
    if (typeof v.toDate === 'function') return v.toDate();
    if (typeof v.seconds === 'number') return new Date(v.seconds * 1000);
    return null;
  }
  const parsed = new Date(value as string | number);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function getComplianceColor(rate: number): string {
  if (rate >= 90) return '#10B981'; // uptimeGreen
  if (rate >= 70) return '#F59E0B'; // warningAmber
  return '#EF4444'; // criticalRed
}

export function getComplianceTailwindClass(rate: number): string {
  if (rate >= 90) return 'text-emerald-600';
  if (rate >= 70) return 'text-amber-600';
  return 'text-red-600';
}

// ---------------------------------------------------------------------------
// Operational Status Calculator
// ---------------------------------------------------------------------------

// Work-order statuses that mean a technician is actively servicing the PM
// (or it is on a short hold mid-job) vs. finished.
const WO_IN_PROGRESS_STATUSES = ['IN_PROGRESS', 'ON_HOLD_PARTS', 'ON_HOLD_APPROVAL'];
const WO_DONE_STATUSES = ['COMPLETED', 'SIGNED_OFF', 'CLOSED'];

export function getPMOperationalStatus(
  schedule: Pick<PMSchedule, 'status' | 'nextDueDate'> & { activeWoStatus?: string | null },
): PMOperationalStatus {
  if (schedule.status === 'paused') return 'paused';
  if (schedule.status === 'completed') return 'completed';

  // Reflect the live work order servicing this schedule so PM Schedules and the
  // PM Calendar track the WO's real-time progress (in progress vs. completed)
  // rather than only the calendar-derived due state.
  const woStatus = schedule.activeWoStatus ?? null;
  if (woStatus && WO_IN_PROGRESS_STATUSES.includes(woStatus)) return 'in_progress';
  if (woStatus && WO_DONE_STATUSES.includes(woStatus)) return 'completed';

  if (schedule.status === 'archived') return 'on_track';

  const now = new Date();
  const nextDue = schedule.nextDueDate instanceof Date
    ? schedule.nextDueDate
    : (schedule.nextDueDate as any).toDate ? (schedule.nextDueDate as any).toDate() : new Date(schedule.nextDueDate as any);

  if (nextDue < now) return 'overdue';

  const dueSoonThreshold = new Date(now);
  dueSoonThreshold.setDate(dueSoonThreshold.getDate() + PM_DUE_SOON_DAYS);

  if (nextDue <= dueSoonThreshold) return 'due_soon';

  return 'on_track';
}

// ---------------------------------------------------------------------------
// Days until due
// ---------------------------------------------------------------------------

export function getDaysUntilDue(nextDueDate: Date | { toDate(): Date }): number {
  const due = nextDueDate instanceof Date
    ? nextDueDate
    : typeof (nextDueDate as any).toDate === 'function' ? (nextDueDate as any).toDate() : new Date(nextDueDate as any);

  const now = new Date();
  now.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);

  const diffMs = due.getTime() - now.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

// ---------------------------------------------------------------------------
// Format month key (YYYY-MM)
// ---------------------------------------------------------------------------

export function getMonthKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

// ---------------------------------------------------------------------------
// Workload color based on load
// ---------------------------------------------------------------------------

export function getWorkloadColor(totalHours: number): string {
  if (totalHours <= 20) return '#10B981'; // Green
  if (totalHours <= 40) return '#F59E0B'; // Amber
  return '#EF4444'; // Red
}

export function getWorkloadTailwindClass(totalHours: number): string {
  if (totalHours <= 20) return 'bg-emerald-500';
  if (totalHours <= 40) return 'bg-amber-500';
  return 'bg-red-500';
}
