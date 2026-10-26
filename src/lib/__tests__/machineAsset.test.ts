import { describe, expect, it } from 'vitest';
import { annualDepreciation, depreciationSoFar, bookValue, expectedScrapValue, outsourcedJobTotals, partLineTotal, replaceAdvice, workOrderCost } from '../machineAsset';

const YEAR = 365.25 * 24 * 3600 * 1000;
const t0 = Date.UTC(2020, 0, 1);

describe('expectedScrapValue', () => {
  it('takes 20% under 5 years, 10% for 5-10 years and 5% beyond', () => {
    expect(expectedScrapValue({ purchasePrice: 1_000_000, lifespanYears: 4 })).toEqual({ value: 200_000, percent: 20 });
    expect(expectedScrapValue({ purchasePrice: 1_000_000, lifespanYears: 4.9 })?.percent).toBe(20);
    expect(expectedScrapValue({ purchasePrice: 1_000_000, lifespanYears: 5 })).toEqual({ value: 100_000, percent: 10 });
    expect(expectedScrapValue({ purchasePrice: 1_000_000, lifespanYears: 10 })).toEqual({ value: 100_000, percent: 10 });
    expect(expectedScrapValue({ purchasePrice: 1_000_000, lifespanYears: 10.5 })).toEqual({ value: 50_000, percent: 5 });
    expect(expectedScrapValue({ purchasePrice: 1_000_000, lifespanYears: 20 })).toEqual({ value: 50_000, percent: 5 });
  });
  it('is null without price or lifespan', () => {
    expect(expectedScrapValue({ purchasePrice: null, lifespanYears: 10 })).toBeNull();
    expect(expectedScrapValue({ purchasePrice: 0, lifespanYears: 10 })).toBeNull();
    expect(expectedScrapValue({ purchasePrice: 1000, lifespanYears: null })).toBeNull();
    expect(expectedScrapValue({ purchasePrice: 1000, lifespanYears: 0 })).toBeNull();
  });
});

describe('bookValue', () => {
  it('falls straight-line from price to the expected scrap value', () => {
    const base = { purchasePrice: 1_000_000, purchasedAtMs: t0, lifespanYears: 10 };
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

describe('workOrderCost', () => {
  it('counts parts and contractor charge on finished work orders only', () => {
    const parts = [{ quantity: 2, unitCost: 100, totalCost: 200 }, { quantity: 1, unitCost: 50 }];
    expect(workOrderCost({ status: 'SIGNED_OFF', partsUsed: parts, projectCost: 300 })).toBe(550);
    expect(workOrderCost({ status: 'IN_PROGRESS', partsUsed: parts, projectCost: 300 })).toBe(0);
    expect(workOrderCost({ status: 'CLOSED' })).toBe(0);
  });
});

describe('depreciation', () => {
  it('works out the yearly amount and what has been written off', () => {
    expect(annualDepreciation({ purchasePrice: 1_000_000, lifespanYears: 10 })).toBe(90_000);
    expect(annualDepreciation({ purchasePrice: 1_000_000, lifespanYears: 4 })).toBe(200_000);
    expect(annualDepreciation({ purchasePrice: 1_000_000, lifespanYears: null })).toBeNull();
    expect(depreciationSoFar(1_000_000, 550_000)).toEqual({ amount: 450_000, percent: 45 });
    expect(depreciationSoFar(1_000_000, null)).toBeNull();
  });
});
