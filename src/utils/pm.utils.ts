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

export function getPMOperationalStatus(
  schedule: Pick<PMSchedule, 'status' | 'nextDueDate'>,
): PMOperationalStatus {
  if (schedule.status === 'paused') return 'paused';
  if (schedule.status === 'archived' || schedule.status === 'completed') return 'on_track';

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
