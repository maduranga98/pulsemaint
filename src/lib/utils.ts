import type { Timestamp } from 'firebase/firestore';
import type { BreakdownSeverity } from '../types';
import { SLA_DURATION_MS, TICKET_PREFIX, TICKET_SEQUENCE_PAD } from '../constants/sla';

// ---------------------------------------------------------------------------
// Ticket number
// ---------------------------------------------------------------------------

export function formatTicketNumber(year: number, sequence: number): string {
  return `${TICKET_PREFIX}-${year}-${String(sequence).padStart(TICKET_SEQUENCE_PAD, '0')}`;
}

// ---------------------------------------------------------------------------
// SLA
// ---------------------------------------------------------------------------

export function calcSlaDeadline(reportedAt: Date, severity: BreakdownSeverity): Date {
  return new Date(reportedAt.getTime() + SLA_DURATION_MS[severity]);
}

export function getMsUntilSla(deadline: Timestamp): number {
  return deadline.toMillis() - Date.now();
}

// ---------------------------------------------------------------------------
// Duration formatting
// ---------------------------------------------------------------------------

export function formatDurationMs(ms: number): string {
  if (ms < 0) ms = 0;
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;

  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export function formatDurationHuman(ms: number): string {
  if (ms < 0) ms = 0;
  const h = Math.floor(ms / (60 * 60 * 1000));
  const m = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000));
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
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
  if (diffMin < 1)   return 'just now';
  if (diffMin < 60)  return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24)    return `${diffH}h ago`;
  const diffD = Math.floor(diffH / 24);
  return `${diffD}d ago`;
}

// ---------------------------------------------------------------------------
// Misc
// ---------------------------------------------------------------------------

export function clsx(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}

export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function slugify(s: string): string {
  return s.toLowerCase().replace(/\s+/g, '_');
}

export function bytesToMb(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
