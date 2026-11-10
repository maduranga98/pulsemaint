import { describe, it, expect } from 'vitest';
import { pmMonthCompliance, pmMonthKey } from '../pmMonthCompliance';

const now = new Date(2026, 10, 10, 12, 0);
const day = (d: number) => new Date(2026, 10, d, 9, 0);
const rec = (status: string, due: number, month = '2026-11', completed: Date | null = null) => ({ status, dueDate: day(due), completedDate: completed, month });

describe('pmMonthKey', () => {
  it('pads the month', () => {
    expect(pmMonthKey(2026, 10)).toBe('2026-11');
    expect(pmMonthKey(2027, 0)).toBe('2027-01');
  });
});

describe('pmMonthCompliance', () => {
  it('counts on-time PMs against everything that has fallen due', () => {
    const history = [
      rec('completed_on_time', 2, '2026-11', day(2)),
      rec('completed_on_time', 3, '2026-11', day(3)),
      rec('completed_late', 5, '2026-11', day(7)),
      rec('missed', 6),
      rec('in_progress', 7), // open and past due → overdue
      rec('in_progress', 20), // not due yet → left out
    ];
    expect(pmMonthCompliance(history, '2026-11', now)).toEqual({ due: 5, onTime: 2, percent: 40 });
  });
  it('ignores other months', () => {
    const history = [rec('completed_on_time', 2, '2026-10'), rec('missed', 3, '2026-10')];
    expect(pmMonthCompliance(history, '2026-11', now)).toEqual({ due: 0, onTime: 0, percent: null });
  });
  it('has no percentage while nothing has fallen due', () => {
    expect(pmMonthCompliance([rec('in_progress', 25)], '2026-11', now).percent).toBeNull();
    expect(pmMonthCompliance([], '2026-11', now).percent).toBeNull();
  });
  it('is 100 % when every due PM was on time', () => {
    expect(pmMonthCompliance([rec('completed_on_time', 2, '2026-11', day(2))], '2026-11', now).percent).toBe(100);
  });
});
