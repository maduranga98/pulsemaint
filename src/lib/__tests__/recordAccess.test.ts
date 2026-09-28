import { describe, it, expect } from 'vitest';
import {
  formatTimeLeft,
  fromDateTimeLocalValue,
  isGrantActive,
  stripUndefined,
  toDateTimeLocalValue,
} from '../recordAccess';

const ts = (ms: number) => ({ toMillis: () => ms });

describe('isGrantActive', () => {
  it('is active before expiry and inactive at/after it', () => {
    expect(isGrantActive({ expiresAt: ts(2000) }, 1000)).toBe(true);
    expect(isGrantActive({ expiresAt: ts(2000) }, 2000)).toBe(false);
    expect(isGrantActive({ expiresAt: ts(2000) }, 3000)).toBe(false);
  });
  it('treats a missing expiry as expired', () => {
    expect(isGrantActive({ expiresAt: null }, 0)).toBe(false);
  });
});

describe('formatTimeLeft', () => {
  const now = 0;
  const min = 60_000;
  it('formats days, hours and minutes', () => {
    expect(formatTimeLeft(ts(2 * 1440 * min + 4 * 60 * min), now)).toBe('2d 4h');
    expect(formatTimeLeft(ts(3 * 1440 * min), now)).toBe('3d');
    expect(formatTimeLeft(ts(3 * 60 * min + 15 * min), now)).toBe('3h 15m');
    expect(formatTimeLeft(ts(12 * min), now)).toBe('12m');
    expect(formatTimeLeft(ts(10_000), now)).toBe('1m');
  });
  it('is empty once expired', () => {
    expect(formatTimeLeft(ts(0), now)).toBe('');
  });
});

describe('datetime-local round trip', () => {
  it('parses what it formats (minute precision)', () => {
    const ms = new Date(2026, 8, 26, 14, 30).getTime();
    expect(fromDateTimeLocalValue(toDateTimeLocalValue(ms))).toBe(ms);
  });
  it('returns NaN for empty input', () => {
    expect(Number.isNaN(fromDateTimeLocalValue(''))).toBe(true);
  });
});

describe('stripUndefined', () => {
  it('drops undefined deeply but keeps class instances', () => {
    class Stamp { constructor(public s: number) {} }
    const stamp = new Stamp(1);
    const out = stripUndefined({ a: 1, b: undefined, c: { d: undefined, e: stamp }, f: [1, undefined, { g: undefined }] });
    expect(out).toEqual({ a: 1, c: { e: stamp }, f: [1, {}] });
    expect((out as { c: { e: unknown } }).c.e).toBe(stamp);
  });
});
