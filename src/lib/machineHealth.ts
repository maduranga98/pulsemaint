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
 */

import type { Timestamp } from 'firebase/firestore';

interface BreakdownForHealth {
  severity: 'critical' | 'high' | 'medium' | 'low';
  date: Timestamp;
}

interface MaintenanceWorkForHealth {
  type: string;
  dateCompleted: Timestamp;
}

export interface HealthScoreInput {
  status: 'active' | 'under_maintenance' | 'decommissioned';
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
