import type { Timestamp } from 'firebase/firestore';
import type { BreakdownSeverity } from '../types';

// ---------------------------------------------------------------------------
// Duration formatting
// ---------------------------------------------------------------------------

export function formatDurationMinutes(minutes: number): string {
  if (minutes < 0) minutes = 0;
  const h = Math.floor(minutes / 60);
  const m = Math.floor(minutes % 60);
  if (h > 0) return `${h}h ${m.toString().padStart(2, '0')}m`;
  return `${m}m`;
}

export function formatDurationHours(hours: number): string {
  if (hours < 0) hours = 0;
  const h = Math.floor(hours);
  const m = Math.floor((hours - h) * 60);
  if (h > 0) return `${h}h ${m.toString().padStart(2, '0')}m`;
  return `${m}m`;
}

export function formatDurationSeconds(totalSeconds: number): string {
  if (totalSeconds < 0) totalSeconds = 0;
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// MTTR / MTBF calculations
// ---------------------------------------------------------------------------

export function calculateMttr(totalRepairMinutes: number, closedCount: number): number {
  if (closedCount === 0) return 0;
  return totalRepairMinutes / closedCount / 60; // hours
}

export function calculateMtbf(totalUptimeHours: number, breakdownCount: number): number {
  if (breakdownCount === 0) return 0;
  return totalUptimeHours / breakdownCount;
}

// ---------------------------------------------------------------------------
// Trend direction
// ---------------------------------------------------------------------------

export function trendDirection(current: number, previous: number): 'up' | 'down' | 'neutral' {
  if (previous === 0) return current > 0 ? 'up' : 'neutral';
  const change = (current - previous) / previous;
  if (Math.abs(change) < 0.01) return 'neutral';
  return change > 0 ? 'up' : 'down';
}

export function trendPercent(current: number, previous: number): number {
  if (previous === 0) return 0;
  return Math.round(((current - previous) / previous) * 100);
}

// ---------------------------------------------------------------------------
// Color thresholds
// ---------------------------------------------------------------------------

export function activeBreakdownColor(count: number): 'green' | 'amber' | 'red' {
  if (count <= 1) return 'green';
  if (count <= 5) return 'amber';
  return 'red';
}

export function mttrColor(mttrHours: number, slaTargetHours: number): 'green' | 'amber' | 'red' {
  if (mttrHours < slaTargetHours * 0.8) return 'green';
  if (mttrHours <= slaTargetHours) return 'amber';
  return 'red';
}

export function openWoColor(count: number): 'green' | 'amber' {
  if (count > 10) return 'amber';
  return 'green';
}

export function complianceColor(rate: number): 'green' | 'amber' | 'red' {
  if (rate >= 90) return 'green';
  if (rate >= 70) return 'amber';
  return 'red';
}

export function severityColor(severity: BreakdownSeverity): string {
  switch (severity) {
    case 'critical':
      return '#EF4444';
    case 'high':
      return '#F59E0B';
    case 'medium':
      return '#EAB308';
    case 'low':
      return '#10B981';
    default:
      return '#8BA3BF';
  }
}

// ---------------------------------------------------------------------------
// Timestamp helpers
// ---------------------------------------------------------------------------

export function tsToDate(ts: Timestamp | null | undefined): Date | null {
  return ts ? ts.toDate() : null;
}

export function relativeTime(ts: Timestamp): string {
  const diffMs = Date.now() - ts.toMillis();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  const diffD = Math.floor(diffH / 24);
  return `${diffD}d ago`;
}

export function dateRangeFromChartRange(range: '7D' | '30D' | '3M' | '6M' | '12M'): { from: Date; to: Date } {
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
  return { from, to };
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

export function formatCurrencyLKR(amount: number): string {
  return `LKR ${amount.toLocaleString('en-LK', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export function formatPercent(value: number, decimals = 0): string {
  return `${value.toFixed(decimals)}%`;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || 'U';
}
