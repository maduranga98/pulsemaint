import { describe, it, expect } from 'vitest';
import {
  computeExpectedEndDate,
  computeDurationInMonths,
  isValidDurationRange,
  formatDurationLabel,
} from '../traineeProgram/programmeDuration';

describe('programmeDuration', () => {
  it('computes preset end dates by adding calendar months', () => {
    const start = new Date('2026-01-15T00:00:00Z');
    expect(computeExpectedEndDate(6, start).toISOString().slice(0, 10)).toBe('2026-07-15');
    expect(computeExpectedEndDate(12, start).toISOString().slice(0, 10)).toBe('2027-01-15');
  });

  it('uses the supplied end date for a custom range', () => {
    const start = new Date('2026-01-15T00:00:00Z');
    const end = new Date('2026-04-01T00:00:00Z');
    expect(computeExpectedEndDate('custom', start, end)).toBe(end);
  });

  it('throws for custom preset without an end date', () => {
    expect(() => computeExpectedEndDate('custom', new Date())).toThrow();
  });

  it('computes an approximate whole-month span for custom ranges', () => {
    expect(computeDurationInMonths(new Date('2026-01-01'), new Date('2026-07-01'))).toBe(6);
    expect(computeDurationInMonths(new Date('2026-01-01'), new Date('2026-01-15'))).toBe(1);
    expect(computeDurationInMonths(new Date('2026-01-01'), new Date('2026-01-01'))).toBe(0);
    expect(computeDurationInMonths(new Date('2026-06-01'), new Date('2026-01-01'))).toBe(0);
  });

  it('validates that end date is after start date', () => {
    expect(isValidDurationRange(new Date('2026-01-01'), new Date('2026-02-01'))).toBe(true);
    expect(isValidDurationRange(new Date('2026-01-01'), new Date('2026-01-01'))).toBe(false);
    expect(isValidDurationRange(new Date('2026-02-01'), new Date('2026-01-01'))).toBe(false);
  });

  it('formats duration labels', () => {
    expect(formatDurationLabel(6, 6)).toBe('6 months');
    expect(formatDurationLabel(12, 12)).toBe('12 months');
    expect(formatDurationLabel('custom', 9)).toBe('9 months (custom)');
    expect(formatDurationLabel('custom', 1)).toBe('1 month (custom)');
  });
});
