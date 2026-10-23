/**
 * The 90-day view window: store keeper, safety officer, HR officer and
 * supervisor see a FINISHED record (closed work order, closed safety case or
 * work permit) only for 90 days after it finished. Admin and plant manager
 * keep the whole year. Nothing is deleted — records stay stored until the
 * one-year retention clean-up — and this is a display limit (the Firestore
 * rules still let these roles read the older records).
 *
 * Open records are never hidden. Completed audits and submitted evaluations
 * are already admin-only, so they need no window.
 */
import type { UserRole } from '@/types/auth';

export const VIEW_WINDOW_DAYS = 90;
const DAY_MS = 24 * 60 * 60 * 1000;

const WINDOWED_ROLES: readonly string[] = ['store_keeper', 'safety_officer', 'hr_officer', 'supervisor'];

/** Whether this role only sees the last 90 days of finished records. */
export function hasViewWindow(role: UserRole | string | null | undefined): boolean {
  return !!role && WINDOWED_ROLES.includes(role);
}

/** The oldest finish time (ms) still visible to `role`, or null when the role has no window. */
export function viewWindowStartMs(role: UserRole | string | null | undefined, nowMs: number = Date.now()): number | null {
  return hasViewWindow(role) ? nowMs - VIEW_WINDOW_DAYS * DAY_MS : null;
}

interface TimestampLike {
  toMillis?: () => number;
  seconds?: number;
}

function toMs(ts: TimestampLike | null | undefined): number | null {
  if (!ts) return null;
  if (typeof ts.toMillis === 'function') return ts.toMillis();
  if (typeof ts.seconds === 'number') return ts.seconds * 1000;
  return null;
}

/**
 * Whether a record has dropped out of `role`'s window: it is finished and
 * finished more than 90 days ago. `finishedAt` is the finish timestamp
 * (null / missing = not finished, or unknown, so it stays visible).
 */
export function isBeyondViewWindow(
  role: UserRole | string | null | undefined,
  finished: boolean,
  finishedAt: TimestampLike | null | undefined,
  nowMs: number = Date.now(),
): boolean {
  const start = viewWindowStartMs(role, nowMs);
  if (start === null || !finished) return false;
  const ms = toMs(finishedAt);
  return ms !== null && ms < start;
}
