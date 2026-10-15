/**
 * Machine health score calculation logic.
 *
 * Formula:
 *   Start: 100 points
 *   Deductions (last 90 days):
 *     - Critical breakdown: -20 points each
 *     - High breakdown: -12 points each
 *     - Medium breakdown: -6 points each
 *     - Low breakdown: -3 points each
 *     - Overdue PM: -10 points each
 *     - Currently Under Maintenance: -5 points baseline
 *   Additions:
 *     - PM completed on time: +5 points each (max +20 total)
 *   Final: clamped to 0–100
 *
 * The score is computed server-side (functions/src/machines/machineHealth.js,
 * a port of machineHealthScoreFromRecords below — kept in sync by
 * src/lib/__tests__/machineHealthParity.test.ts) and stored on
 * machines/{id}.healthScore, so every screen, report and MOE snapshot shows
 * the same number. It is never typed in by hand.
 */

import type { Timestamp } from 'firebase/firestore';

interface BreakdownForHealth {
  severity: 'critical' | 'high' | 'medium' | 'low';
  date: Timestamp | Date;
}

interface MaintenanceWorkForHealth {
  type: string;
  dateCompleted: Timestamp | Date;
}

export interface HealthScoreInput {
  status: 'active' | 'under_maintenance' | 'decommissioned' | 'scrapped';
  breakdownsLast90Days: BreakdownForHealth[];
  maintenanceCompletedLast90Days: MaintenanceWorkForHealth[];
  overduePMs: number;
}

const BREAKDOWN_DEDUCTIONS: Record<string, number> = {
  critical: 20,
  high: 12,
  medium: 6,
  low: 3,
};

const UNDER_MAINTENANCE_DEDUCTION = 5;
const OVERDUE_PM_DEDUCTION = 10;
const ON_TIME_PM_ADDITION = 5;
const MAX_PM_ADDITIONS = 20; // max +20 points from PMs

export function calculateMachineHealthScore(input: HealthScoreInput): number {
  let score = 100;

  // Deduct for breakdowns in last 90 days
  for (const breakdown of input.breakdownsLast90Days) {
    score -= BREAKDOWN_DEDUCTIONS[breakdown.severity] || 0;
  }

  // Deduct for overdue PMs
  score -= input.overduePMs * OVERDUE_PM_DEDUCTION;

  // Deduct if currently under maintenance
  if (input.status === 'under_maintenance') {
    score -= UNDER_MAINTENANCE_DEDUCTION;
  }

  // Add back for completed PMs on time (max +20 total)
  const pmAdditions = Math.min(
    input.maintenanceCompletedLast90Days.length * ON_TIME_PM_ADDITION,
    MAX_PM_ADDITIONS
  );
  score += pmAdditions;

  // Clamp to 0-100
  return Math.max(0, Math.min(100, score));
}

export const HEALTH_WINDOW_DAYS = 90;
const DAY_MS = 86_400_000;
const SEVERITIES = new Set(['critical', 'high', 'medium', 'low']);

type Row = Record<string, any>;

function toDateOrNull(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const v = value as { toDate?: () => Date; seconds?: number };
  if (typeof v.toDate === 'function') return v.toDate();
  if (typeof v.seconds === 'number') return new Date(v.seconds * 1000);
  const d = new Date(value as string | number);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * The health-score inputs from a machine's raw records:
 *  - breakdowns reported in the last 90 days, cancelled ones excluded; one
 *    not assessed yet (no severity) counts as medium;
 *  - overdue PMs: occurrences still open past their due date, plus those
 *    closed as missed that were due in the last 90 days;
 *  - PMs completed on time in the last 90 days.
 */
export function machineHealthInputs(
  machineStatus: unknown,
  breakdowns: Row[],
  pmHistory: Row[],
  now: Date = new Date(),
): HealthScoreInput {
  const since = now.getTime() - HEALTH_WINDOW_DAYS * DAY_MS;
  const inWindow = (d: Date | null) => !!d && d.getTime() >= since && d.getTime() <= now.getTime();

  const breakdownsLast90Days: BreakdownForHealth[] = [];
  breakdowns.forEach((b) => {
    if (String(b.status ?? '') === 'cancelled') return;
    const reported = toDateOrNull(b.reportedAt ?? b.createdAt);
    if (!inWindow(reported)) return;
    const severity = SEVERITIES.has(String(b.severity)) ? (b.severity as BreakdownForHealth['severity']) : 'medium';
    breakdownsLast90Days.push({ severity, date: reported! });
  });

  let overduePMs = 0;
  const maintenanceCompletedLast90Days: MaintenanceWorkForHealth[] = [];
  pmHistory.forEach((p) => {
    const status = String(p.status ?? '');
    const due = toDateOrNull(p.dueDate);
    const completed = toDateOrNull(p.completedDate);
    if (status === 'completed_on_time') {
      if (inWindow(completed ?? due)) maintenanceCompletedLast90Days.push({ type: 'pm', dateCompleted: (completed ?? due)! });
      return;
    }
    if (status === 'completed_late') return;
    if (status === 'missed') {
      if (inWindow(due)) overduePMs += 1;
      return;
    }
    // Still open (in progress / overdue): overdue once its due date has passed.
    if (!completed && due && due.getTime() < now.getTime()) overduePMs += 1;
  });

  const status: HealthScoreInput['status'] =
    machineStatus === 'under_maintenance' || machineStatus === 'decommissioned' ? machineStatus : 'active';
  return { status, breakdownsLast90Days, maintenanceCompletedLast90Days, overduePMs };
}

/** The machine's health score from its raw records (see machineHealthInputs). */
export function machineHealthScoreFromRecords(
  machineStatus: unknown,
  breakdowns: Row[],
  pmHistory: Row[],
  now: Date = new Date(),
): number {
  return calculateMachineHealthScore(machineHealthInputs(machineStatus, breakdowns, pmHistory, now));
}

export function getHealthScoreColor(score: number): string {
  if (score >= 70) return '#10B981'; // green
  if (score >= 40) return '#F59E0B'; // amber
  return '#EF4444'; // red
}

export function getHealthScoreLabel(score: number): string {
  if (score >= 70) return 'Healthy';
  if (score >= 40) return 'Warning';
  return 'Critical';
}

export function formatMachineAge(installationDate: Date | null | undefined): {
  ageYears: number;
  ageMonths: number;
} {
  if (!installationDate) {
    return { ageYears: 0, ageMonths: 0 };
  }

  const now = new Date();
  const installation = new Date(installationDate);

  let ageYears = now.getFullYear() - installation.getFullYear();
  let ageMonths = now.getMonth() - installation.getMonth();

  if (ageMonths < 0) {
    ageYears--;
    ageMonths += 12;
  }

  return { ageYears, ageMonths };
}

export function getHealthScoreTrend(
  currentScore: number,
  previousScore: number | null
): 'improving' | 'stable' | 'declining' | 'unknown' {
  if (previousScore === null) return 'unknown';

  const diff = currentScore - previousScore;
  if (diff > 5) return 'improving';
  if (diff < -5) return 'declining';
  return 'stable';
}
