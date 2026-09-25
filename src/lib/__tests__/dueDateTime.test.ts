import { describe, it, expect } from 'vitest';
import { combineDueDateTime, formatDueDateTime } from '../training/dueDateTime';

describe('combineDueDateTime', () => {
  it('returns null without a date', () => {
    expect(combineDueDateTime('', '10:00')).toBeNull();
  });

  it('builds a local date-time from the picked date and time', () => {
    const d = combineDueDateTime('2026-09-25', '14:30')!;
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes()]).toEqual([2026, 8, 25, 14, 30]);
  });

  it('defaults to end of day when no time is picked', () => {
    const d = combineDueDateTime('2026-09-25', '')!;
    expect([d.getDate(), d.getHours(), d.getMinutes()]).toEqual([25, 23, 59]);
  });
});

describe('formatDueDateTime', () => {
  it('formats Firestore-like timestamps with the time', () => {
    const date = new Date(2026, 8, 25, 9, 5);
    expect(formatDueDateTime({ seconds: date.getTime() / 1000 })).toContain('09:05');
    expect(formatDueDateTime({ toDate: () => date })).toContain('2026');
  });

  it('returns the empty placeholder for missing values', () => {
    expect(formatDueDateTime(null, '—')).toBe('—');
  });
});
