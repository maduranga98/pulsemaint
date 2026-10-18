import { describe, it, expect } from 'vitest';
import { PLAN_LIMITS, ENTERPRISE_TIER_LIMITS, limitsForCompany, seatTypeForRole } from '../planLimits';
import { ENTERPRISE_PLANS, PLAN_PRICES } from '../planCatalog';

describe('PLAN_LIMITS', () => {
  it('carries the agreed count limits', () => {
    const pick = (p: keyof typeof PLAN_LIMITS) => {
      const { features: _f, ...counts } = PLAN_LIMITS[p];
      return counts;
    };
    const base = { workOrdersPerMonth: null };
    expect(pick('starter')).toEqual({ ...base, fullUsers: 3, lightUsers: 10, plants: 1, machines: 15, inventoryItems: 100, pmSchedules: 30, aiCreditsPerMonth: 20, analyticsHistoryMonths: 12 });
    expect(pick('workshop')).toEqual({ ...base, fullUsers: 10, lightUsers: 50, plants: 1, machines: 75, inventoryItems: 2000, pmSchedules: 400, aiCreditsPerMonth: 150, analyticsHistoryMonths: 36 });
    expect(pick('factory')).toEqual({ ...base, fullUsers: 40, lightUsers: 250, plants: 1, machines: 400, inventoryItems: 10000, pmSchedules: 3000, aiCreditsPerMonth: 800, analyticsHistoryMonths: null });
  });
  it('grows with every plan', () => {
    for (const key of ['fullUsers', 'lightUsers', 'machines', 'inventoryItems', 'pmSchedules', 'aiCreditsPerMonth'] as const) {
      expect(PLAN_LIMITS.starter[key]!).toBeLessThan(PLAN_LIMITS.workshop[key]!);
      expect(PLAN_LIMITS.workshop[key]!).toBeLessThan(PLAN_LIMITS.factory[key]!);
    }
  });
  it('prices every self-serve plan and leaves Enterprise custom', () => {
    expect(PLAN_PRICES.starter).toEqual({ monthly: 25, yearly: 250 });
    expect(PLAN_PRICES.workshop).toEqual({ monthly: 89, yearly: 890 });
    expect(PLAN_PRICES.factory).toEqual({ monthly: 379, yearly: 3790 });
    expect(PLAN_PRICES.enterprise.monthly).toBeNull();
  });
});

describe('limitsForCompany', () => {
  it('uses the plan limits by default', () => {
    expect(limitsForCompany({ plan: 'workshop' }).machines).toBe(75);
    expect(limitsForCompany(null).machines).toBe(PLAN_LIMITS.starter.machines);
  });
  it('keeps Enterprise unlimited until a tier is set', () => {
    expect(limitsForCompany({ plan: 'enterprise' }).fullUsers).toBeNull();
    expect(limitsForCompany({ plan: 'enterprise', enterpriseTier: 'enterprise1' }).fullUsers).toBe(100);
    expect(limitsForCompany({ plan: 'enterprise', enterpriseTier: 'enterprise2' }).plants).toBe(10);
  });
  it('ignores an Enterprise tier on other plans', () => {
    expect(limitsForCompany({ plan: 'factory', enterpriseTier: 'enterprise1' }).fullUsers).toBe(40);
  });
  it('applies per-company overrides on top, including unlimited', () => {
    const l = limitsForCompany({ plan: 'workshop', limitOverrides: { machines: 100, fullUsers: null, plants: -3 } });
    expect(l.machines).toBe(100);
    expect(l.fullUsers).toBeNull();
    expect(l.plants).toBe(1); // invalid override ignored
    expect(l.inventoryItems).toBe(2000);
  });
  it('reads an override saved before seats were split as the full-user cap', () => {
    expect(limitsForCompany({ plan: 'starter', limitOverrides: { users: 8 } }).fullUsers).toBe(8);
  });
  it('gives floor operators and trainees light seats, everyone else full seats', () => {
    expect(['floor_operator', 'trainee'].map(seatTypeForRole)).toEqual(['light', 'light']);
    expect(['admin', 'technician', 'safety_officer', 'store_keeper'].map(seatTypeForRole)).toEqual(['full', 'full', 'full', 'full']);
  });
  it('keeps the list-price Enterprise tiers in step with their limits', () => {
    expect(ENTERPRISE_PLANS.map((e) => e.id)).toEqual(Object.keys(ENTERPRISE_TIER_LIMITS));
  });
});
