/** Pure helpers for time-limited record shares (record_access_grants). */

type TsLike = { toMillis?: () => number } | null | undefined;

export function expiryMillis(expiresAt: TsLike): number {
  return expiresAt?.toMillis?.() ?? 0;
}

/** A grant is visible to its grantee only until its expiry. */
export function isGrantActive(grant: { expiresAt: TsLike }, now = Date.now()): boolean {
  return expiryMillis(grant.expiresAt) > now;
}

/** Remaining time as a compact "2d 4h" / "3h 15m" / "12m" string; "" once expired. */
export function formatTimeLeft(expiresAt: TsLike, now = Date.now()): string {
  const ms = expiryMillis(expiresAt) - now;
  if (ms <= 0) return '';
  const mins = Math.max(1, Math.floor(ms / 60000));
  const days = Math.floor(mins / 1440);
  const hours = Math.floor((mins % 1440) / 60);
  const m = mins % 60;
  if (days > 0) return hours ? `${days}d ${hours}h` : `${days}d`;
  if (hours > 0) return m ? `${hours}h ${m}m` : `${hours}h`;
  return `${m}m`;
}

/** Value for an <input type="datetime-local"> in local time. */
export function toDateTimeLocalValue(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Parses a datetime-local value as local time; NaN when empty/invalid. */
export function fromDateTimeLocalValue(v: string): number {
  if (!v) return Number.NaN;
  return new Date(v).getTime();
}

/**
 * Deep copy that drops `undefined` values (Firestore rejects them) while
 * keeping non-plain objects such as Timestamps intact.
 */
export function stripUndefined<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.filter((v) => v !== undefined).map((v) => stripUndefined(v)) as unknown as T;
  }
  if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v !== undefined) out[k] = stripUndefined(v);
    }
    return out as T;
  }
  return value;
}
