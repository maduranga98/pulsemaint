import { describe, it, expect } from 'vitest';
import { PLAN_LIMITS, ENTERPRISE_TIER_LIMITS, limitsForCompany, isLightUserRole } from '../planLimits';
import { ENTERPRISE_PLANS, PLAN_PRICES, formatLimit } from '../planCatalog';

describe('PLAN_LIMITS', () => {
  it('carries the agreed count limits', () => {
    const pick = (p: keyof typeof PLAN_LIMITS) => {
      const { features: _f, ...counts } = PLAN_LIMITS[p];
      return counts;
    };
    expect(pick('starter')).toEqual({
      users: 3, lightUsers: 10, plants: 1, machines: 15, inventoryItems: 100, pmSchedules: 30, workOrdersPerMonth: 60,
      breakdownsPerMonth: 40, contractors: 0, trainingModules: 0, aiCreditsPerMonth: 20, analyticsHistoryMonths: 12,
    });
    expect(pick('workshop')).toEqual({
      users: 10, lightUsers: 50, plants: 1, machines: 75, inventoryItems: 2000, pmSchedules: 400, workOrdersPerMonth: 400,
      breakdownsPerMonth: 300, contractors: 25, trainingModules: 25, aiCreditsPerMonth: 150, analyticsHistoryMonths: 36,
    });
    expect(pick('factory')).toEqual({
      users: 40, lightUsers: 250, plants: 1, machines: 400, inventoryItems: 10000, pmSchedules: 3000, workOrdersPerMonth: 2500,
      breakdownsPerMonth: 2000, contractors: 250, trainingModules: 250, aiCreditsPerMonth: 800, analyticsHistoryMonths: null,
    });
  });
  it('grows with every plan', () => {
    for (const key of [
      'users', 'lightUsers', 'machines', 'inventoryItems', 'pmSchedules', 'workOrdersPerMonth',
      'breakdownsPerMonth', 'contractors', 'trainingModules', 'aiCreditsPerMonth',
    ] as const) {
      expect(PLAN_LIMITS.starter[key]!).toBeLessThan(PLAN_LIMITS.workshop[key]!);
      expect(PLAN_LIMITS.workshop[key]!).toBeLessThan(PLAN_LIMITS.factory[key]!);
    }
  });
  it('prices every self-serve plan and leaves Enterprise custom', () => {
    expect(PLAN_PRICES.starter.monthly).toBe(25);
    expect(PLAN_PRICES.workshop.monthly).toBe(89);
    expect(PLAN_PRICES.factory.monthly).toBe(379);
    expect(PLAN_PRICES.enterprise.monthly).toBeNull();
    expect(PLAN_PRICES.enterprise.minMonthly).toBe(1000);
  });
  it('bills yearly as ten months', () => {
    for (const p of ['starter', 'workshop', 'factory'] as const) {
      expect(PLAN_PRICES[p].yearly).toBe(PLAN_PRICES[p].monthly! * 10);
    }
  });
  it('allows more than one plant on Enterprise only', () => {
    expect(PLAN_LIMITS.factory.plants).toBe(1);
    expect(PLAN_LIMITS.enterprise.plants).toBeNull();
  });
});

describe('limitsForCompany', () => {
  it('uses the plan limits by default', () => {
    expect(limitsForCompany({ plan: 'workshop' }).machines).toBe(75);
    expect(limitsForCompany(null).machines).toBe(PLAN_LIMITS.starter.machines);
  });
  it('keeps Enterprise unlimited until a tier is set', () => {
    expect(limitsForCompany({ plan: 'enterprise' }).users).toBeNull();
    expect(limitsForCompany({ plan: 'enterprise', enterpriseTier: 'enterprise1' }).users).toBe(100);
    expect(limitsForCompany({ plan: 'enterprise', enterpriseTier: 'enterprise1' }).aiCreditsPerMonth).toBe(1500);
    expect(limitsForCompany({ plan: 'enterprise', enterpriseTier: 'enterprise2' }).plants).toBe(10);
  });
  it('ignores an Enterprise tier on other plans', () => {
    expect(limitsForCompany({ plan: 'factory', enterpriseTier: 'enterprise1' }).users).toBe(40);
  });
  it('applies per-company overrides on top, including unlimited', () => {
    const l = limitsForCompany({ plan: 'workshop', limitOverrides: { machines: 100, users: null, plants: -3 } });
    expect(l.machines).toBe(100);
    expect(l.users).toBeNull();
    expect(l.plants).toBe(1); // invalid override ignored
    expect(l.inventoryItems).toBe(2000);
  });
  it('keeps the list-price Enterprise tiers in step with their limits', () => {
    expect(ENTERPRISE_PLANS.map((e) => e.id)).toEqual(Object.keys(ENTERPRISE_TIER_LIMITS));
  });
});

describe('limitsForCompany during a trial', () => {
  const future = { toMillis: () => Date.now() + 86_400_000 };
  const past = { toMillis: () => Date.now() - 86_400_000 };
  it('gives the trial a usable contractor/training cap, other limits stay Starter', () => {
    const l = limitsForCompany({ plan: 'starter', status: 'trial', trialEndsAt: future });
    expect(l.contractors).toBe(25);
    expect(l.trainingModules).toBe(25);
    expect(l.machines).toBe(15);
  });
  it('removes it once the trial has ended', () => {
    const l = limitsForCompany({ plan: 'starter', status: 'trial', trialEndsAt: past });
    expect(l.contractors).toBe(0);
  });
});

describe('light users and display', () => {
  it('treats floor operators and trainees as light users', () => {
    expect(isLightUserRole('floor_operator')).toBe(true);
    expect(isLightUserRole('trainee')).toBe(true);
    expect(isLightUserRole('technician')).toBe(false);
    expect(isLightUserRole(undefined)).toBe(false);
  });
  it('formats limits like the price chart', () => {
    expect(formatLimit(null)).toBe('Unlimited');
    expect(formatLimit(null, false, true)).toBe('All');
    expect(formatLimit(0)).toBe('—');
    expect(formatLimit(2500, true)).toBe('2,500 / month');
    expect(formatLimit(36, false, true)).toBe('36 months');
  });
});
