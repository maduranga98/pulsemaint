import { describe, expect, it } from 'vitest';
import { bookValue, outsourcedJobTotals, partLineTotal, replaceAdvice } from '../machineAsset';

const YEAR = 365.25 * 24 * 3600 * 1000;
const t0 = Date.UTC(2020, 0, 1);

describe('bookValue', () => {
  it('falls straight-line from price to scrap value', () => {
    const base = { purchasePrice: 1_000_000, scrapValue: 100_000, purchasedAtMs: t0, lifespanYears: 10 };
    expect(bookValue({ ...base, now: t0 })).toBe(1_000_000);
    expect(bookValue({ ...base, now: t0 + 5 * YEAR })).toBe(550_000);
    expect(bookValue({ ...base, now: t0 + 30 * YEAR })).toBe(100_000);
  });
  it('is null without price, date or lifespan', () => {
    expect(bookValue({ purchasePrice: null, purchasedAtMs: t0, lifespanYears: 10 })).toBeNull();
    expect(bookValue({ purchasePrice: 5, purchasedAtMs: null, lifespanYears: 10 })).toBeNull();
    expect(bookValue({ purchasePrice: 5, purchasedAtMs: t0, lifespanYears: null })).toBeNull();
  });
});

describe('outsourced totals', () => {
  it('adds parts and labour', () => {
    const parts = [
      { name: 'Bearing', kind: 'replaced' as const, quantity: 2, unitPrice: 4500 },
      { name: 'Sensor', kind: 'added' as const, quantity: 1, unitPrice: 12000 },
    ];
    expect(partLineTotal(parts[0])).toBe(9000);
    expect(outsourcedJobTotals(parts, 8000)).toEqual({ partsTotal: 21000, total: 29000 });
    expect(outsourcedJobTotals([], -5)).toEqual({ partsTotal: 0, total: 0 });
  });
});

describe('replaceAdvice', () => {
  it('flags repair-or-replace by spend vs price and book value', () => {
    expect(replaceAdvice({ purchasePrice: 100, maintenanceCost: 10, bookValue: 80 })).toBe('ok');
    expect(replaceAdvice({ purchasePrice: 100, maintenanceCost: 45, bookValue: 80 })).toBe('watch');
    expect(replaceAdvice({ purchasePrice: 100, maintenanceCost: 65, bookValue: 80 })).toBe('replace');
    expect(replaceAdvice({ purchasePrice: 100, maintenanceCost: 30, bookValue: 20 })).toBe('replace');
    expect(replaceAdvice({ purchasePrice: null, maintenanceCost: 30, bookValue: null })).toBe('ok');
  });
});
