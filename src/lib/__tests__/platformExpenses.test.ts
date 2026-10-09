import { describe, expect, it } from 'vitest';
import { byCategory, missingRecurring, monthKey, sameDayIn, shiftMonth, totalsByCurrency, totalsText, type Expense } from '../platform/expenses';

const d = (y: number, m: number, day = 5) => new Date(y, m - 1, day).getTime();
const e = (over: Partial<Expense>): Expense => ({
  id: Math.random().toString(36), date: d(2026, 10), category: 'hosting', description: 'Firebase', payee: 'Google', amount: 10,
  currency: 'USD', method: 'card', recurrence: 'none', reference: '', notes: '', createdAt: null, createdByEmail: null, ...over,
});

describe('expenses', () => {
  it('month helpers', () => {
    expect(monthKey(d(2026, 1, 31))).toBe('2026-01');
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(new Date(sameDayIn(d(2026, 1, 31), '2026-02')).getDate()).toBe(28);
  });

  it('totals keep currencies apart', () => {
    const t = totalsByCurrency([e({ amount: 10 }), e({ amount: 5.5 }), e({ amount: 1000, currency: 'LKR' })]);
    expect(t).toEqual({ USD: 15.5, LKR: 1000 });
    expect(totalsText(t)).toBe('LKR 1,000 + USD 15.5');
    expect(totalsText({})).toBe('0');
  });

  it('groups by category', () => {
    const g = byCategory([e({ amount: 10 }), e({ category: 'marketing', amount: 50 }), e({ amount: 5 })]);
    expect(g.map((x) => [x.category, x.totals.USD, x.count])).toEqual([['marketing', 50, 1], ['hosting', 15, 2]]);
  });

  it('finds recurring bills not entered for the month', () => {
    const rows = [
      e({ recurrence: 'monthly', date: d(2026, 8) }),
      e({ recurrence: 'monthly', date: d(2026, 9), amount: 12 }),
      e({ recurrence: 'yearly', description: 'Domain', category: 'domain', date: d(2025, 10) }),
      e({ recurrence: 'yearly', description: 'SSL', category: 'domain', date: d(2025, 11) }),
      e({ recurrence: 'monthly', description: 'SMS', payee: 'Dialog', date: d(2026, 9) }),
      e({ description: 'SMS', payee: 'Dialog', date: d(2026, 10) }),
    ];
    const missing = missingRecurring(rows, '2026-10');
    expect(missing.map((x) => `${x.description}:${x.amount}`).sort()).toEqual(['Domain:10', 'Firebase:12']);
  });
});
