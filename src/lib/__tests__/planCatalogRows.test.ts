import { describe, it, expect } from 'vitest';
import { LOCKED_FEATURE_ROWS, PLAN_PRICES, PLAN_STORAGE_GB, FINISHED_RECORDS_KEPT, formatStorageGb } from '../planCatalog';
import { PLAN_LIMITS } from '../planLimits';

describe('plan comparison tables', () => {
  it('lists each locked feature once (rows are keyed by feature)', () => {
    const keys = LOCKED_FEATURE_ROWS.map((r) => r.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  // The product booklet's pricing page (FirmiCore-Booklet.pdf, page 7) is the customer-facing sheet; these must match it.
  it('matches the booklet pricing page', () => {
    expect(PLAN_PRICES.starter).toEqual({ monthly: 25, yearly: 250 });
    expect(PLAN_PRICES.workshop).toEqual({ monthly: 89, yearly: 890 });
    expect(PLAN_PRICES.factory).toEqual({ monthly: 379, yearly: 3790 });
    expect(PLAN_PRICES.enterprise.minMonthly).toBe(1000);
    expect(PLAN_STORAGE_GB).toEqual({ starter: 10, workshop: 50, factory: 250, enterprise: null });
    expect(FINISHED_RECORDS_KEPT).toBe('1 year');
    for (const p of ['starter', 'workshop', 'factory'] as const) expect(PLAN_LIMITS[p].analyticsHistoryMonths).toBe(12);
  });

  it('formats storage', () => {
    expect(formatStorageGb(10)).toBe('10 GB');
    expect(formatStorageGb(250)).toBe('250 GB');
    expect(formatStorageGb(null)).toBe('Custom');
  });
});
