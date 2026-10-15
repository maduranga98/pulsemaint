import { describe, it, expect } from 'vitest';
import { PLAN_LIMITS, ENTERPRISE_TIER_LIMITS, limitsForCompany } from '../planLimits';
import { ENTERPRISE_PLANS, PLAN_PRICES } from '../planCatalog';

describe('PLAN_LIMITS', () => {
  it('carries the agreed count limits', () => {
    const pick = (p: keyof typeof PLAN_LIMITS) => {
      const { features: _f, ...counts } = PLAN_LIMITS[p];
      return counts;
    };
    expect(pick('starter')).toEqual({ users: 5, plants: 1, machines: 10, inventoryItems: 10, pmSchedules: 10, workOrdersPerMonth: 10 });
    expect(pick('workshop')).toEqual({ users: 10, plants: 1, machines: 25, inventoryItems: 40, pmSchedules: 30, workOrdersPerMonth: 50 });
    expect(pick('factory')).toEqual({ users: 30, plants: 3, machines: 70, inventoryItems: 100, pmSchedules: 50, workOrdersPerMonth: 100 });
  });
  it('grows with every plan', () => {
    for (const key of ['users', 'machines', 'inventoryItems', 'pmSchedules', 'workOrdersPerMonth'] as const) {
      expect(PLAN_LIMITS.starter[key]!).toBeLessThan(PLAN_LIMITS.workshop[key]!);
      expect(PLAN_LIMITS.workshop[key]!).toBeLessThan(PLAN_LIMITS.factory[key]!);
    }
  });
  it('prices every self-serve plan and leaves Enterprise custom', () => {
    expect(PLAN_PRICES.starter.monthly).toBe(29);
    expect(PLAN_PRICES.workshop.monthly).toBe(79);
    expect(PLAN_PRICES.factory.monthly).toBe(199);
    expect(PLAN_PRICES.enterprise.monthly).toBeNull();
  });
});

describe('limitsForCompany', () => {
  it('uses the plan limits by default', () => {
    expect(limitsForCompany({ plan: 'workshop' }).machines).toBe(25);
    expect(limitsForCompany(null).machines).toBe(PLAN_LIMITS.starter.machines);
  });
  it('keeps Enterprise unlimited until a tier is set', () => {
    expect(limitsForCompany({ plan: 'enterprise' }).users).toBeNull();
    expect(limitsForCompany({ plan: 'enterprise', enterpriseTier: 'enterprise1' }).users).toBe(100);
    expect(limitsForCompany({ plan: 'enterprise', enterpriseTier: 'enterprise2' }).plants).toBe(10);
  });
  it('ignores an Enterprise tier on other plans', () => {
    expect(limitsForCompany({ plan: 'factory', enterpriseTier: 'enterprise1' }).users).toBe(30);
  });
  it('applies per-company overrides on top, including unlimited', () => {
    const l = limitsForCompany({ plan: 'workshop', limitOverrides: { machines: 100, users: null, plants: -3 } });
    expect(l.machines).toBe(100);
    expect(l.users).toBeNull();
    expect(l.plants).toBe(1); // invalid override ignored
    expect(l.inventoryItems).toBe(40);
  });
  it('keeps the list-price Enterprise tiers in step with their limits', () => {
    expect(ENTERPRISE_PLANS.map((e) => e.id)).toEqual(Object.keys(ENTERPRISE_TIER_LIMITS));
  });
});
