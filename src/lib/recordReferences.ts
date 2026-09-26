/**
 * Which past work orders / breakdowns can be picked on a "record access"
 * request: only finished ones — WOs signed off or closed, breakdowns closed —
 * and only once 30 days have passed since they were finished. Mirrored in
 * functions/src/requests/listRecordReferences.js.
 */

type TsLike = { toMillis?: () => number } | null | undefined;

export const RECORD_ACCESS_MIN_AGE_DAYS = 30;
export const FINISHED_WO_STATUSES = ['SIGNED_OFF', 'CLOSED'] as const;

const DAY = 24 * 60 * 60 * 1000;

function ms(ts: TsLike): number {
  return ts?.toMillis?.() ?? 0;
}

export function recordAccessCutoff(now = Date.now()): number {
  return now - RECORD_ACCESS_MIN_AGE_DAYS * DAY;
}

/** When a WO was finished: supervisor sign-off, else closed, else last update. */
export function woFinishedAtMs(wo: { supervisorSignOffAt?: TsLike; closedAt?: TsLike; updatedAt?: TsLike }): number {
  return ms(wo.supervisorSignOffAt) || ms(wo.closedAt) || ms(wo.updatedAt);
}

/** When a breakdown was finished: closed, else resolved. */
export function bdFinishedAtMs(b: { closedAt?: TsLike; resolvedAt?: TsLike }): number {
  return ms(b.closedAt) || ms(b.resolvedAt);
}

export function isPickableWorkOrder(
  wo: { status?: string | null; supervisorSignOffAt?: TsLike; closedAt?: TsLike; updatedAt?: TsLike },
  now = Date.now(),
): boolean {
  if (!(FINISHED_WO_STATUSES as readonly string[]).includes(wo.status ?? '')) return false;
  const at = woFinishedAtMs(wo);
  return at > 0 && at <= recordAccessCutoff(now);
}

export function isPickableBreakdown(
  b: { status?: string | null; closedAt?: TsLike; resolvedAt?: TsLike },
  now = Date.now(),
): boolean {
  if (b.status !== 'closed') return false;
  const at = bdFinishedAtMs(b);
  return at > 0 && at <= recordAccessCutoff(now);
}
