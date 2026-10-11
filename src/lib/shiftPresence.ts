import type { ShiftSession } from '../types/handover.types';

/**
 * A clocked-in session older than this is a forgotten clock-out, not someone
 * still on shift — long enough for any overnight or double shift, short
 * enough that yesterday's un-ended session stops counting as "present".
 */
export const STALE_SESSION_MS = 24 * 60 * 60 * 1000;

/** True when an 'active' shift session still represents someone on shift now. */
export function isCurrentShiftSession(
  session: Pick<ShiftSession, 'status' | 'actualStart'>,
  now: number = Date.now(),
): boolean {
  if (session.status !== 'active') return false;
  const started = session.actualStart instanceof Date ? session.actualStart.getTime() : NaN;
  // An unreadable start time can't be judged stale — keep it.
  if (Number.isNaN(started)) return true;
  return now - started < STALE_SESSION_MS;
}

/**
 * Distinct people currently on shift. A user can end up with more than one
 * 'active' session doc (double clock-in, retry after a network error), which
 * must still count as one person present.
 */
export function presentUserIds(
  sessions: Array<Pick<ShiftSession, 'status' | 'actualStart' | 'userId'>>,
  now: number = Date.now(),
): string[] {
  const ids = new Set<string>();
  for (const s of sessions) {
    if (s.userId && isCurrentShiftSession(s, now)) ids.add(s.userId);
  }
  return Array.from(ids);
}
