/** Due time used when an assigner picks a due date but leaves the time blank. */
export const DEFAULT_DUE_TIME = '23:59';

/**
 * Combines an <input type="date"> value ('YYYY-MM-DD') and an
 * <input type="time"> value ('HH:mm') into a local Date. Returns null when no
 * date is picked. `new Date('YYYY-MM-DD')` parses as UTC midnight, which
 * shifted due dates a day early/late depending on timezone — so the parts are
 * built as local time here.
 */
export function combineDueDateTime(date: string, time: string): Date | null {
  if (!date) return null;
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = (time || DEFAULT_DUE_TIME).split(':').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d, hh || 0, mm || 0, 0, 0);
}

function toDate(ts: unknown): Date | null {
  if (!ts) return null;
  if (ts instanceof Date) return ts;
  const t = ts as { toDate?: () => Date; seconds?: number };
  if (typeof t.toDate === 'function') return t.toDate();
  if (typeof t.seconds === 'number') return new Date(t.seconds * 1000);
  return null;
}

/** Formats a due date (Firestore Timestamp, {seconds}, or Date) as "25 Sept 2026, 17:00". */
export function formatDueDateTime(ts: unknown, empty = ''): string {
  const date = toDate(ts);
  if (!date) return empty;
  const day = date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const time = date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
  return `${day}, ${time}`;
}
