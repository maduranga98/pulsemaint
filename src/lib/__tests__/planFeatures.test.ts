import { describe, it, expect } from 'vitest';
import { isTrialExpired, isFeatureAvailable, featureForPath, type PlanCompanyState } from '../planLimits';

const DAY = 86_400_000;
const ts = (ms: number) => ({ toMillis: () => ms });
const trial = (offsetDays: number, extra: Partial<PlanCompanyState> = {}): PlanCompanyState => ({
  plan: 'starter', status: 'trial', trialEndsAt: ts(Date.now() + offsetDays * DAY), ...extra,
});

describe('isTrialExpired', () => {
  it('is false while the trial runs and true after it ends', () => {
    expect(isTrialExpired(trial(3))).toBe(false);
    expect(isTrialExpired(trial(-1))).toBe(true);
  });
  it('ignores companies with a subscription or a Lumora-assigned plan', () => {
    expect(isTrialExpired(trial(-1, { stripeSubscriptionId: 'sub_1' }))).toBe(false);
    expect(isTrialExpired(trial(-1, { planSetBy: 'platform' }))).toBe(false);
  });
  it('is false for non-trial companies', () => {
    expect(isTrialExpired({ plan: 'starter', status: 'active' })).toBe(false);
  });
});

describe('isFeatureAvailable', () => {
  it('unlocks features during a running trial, except multi-site', () => {
    expect(isFeatureAvailable(trial(5), 'contractors')).toBe(true);
    expect(isFeatureAvailable(trial(5), 'multiSite')).toBe(false);
  });
  it('locks Starter features once the trial has ended', () => {
    expect(isFeatureAvailable(trial(-1), 'contractors')).toBe(false);
  });
  it('follows the plan matrix for active companies', () => {
    expect(isFeatureAvailable({ plan: 'starter', status: 'active' }, 'training')).toBe(false);
    expect(isFeatureAvailable({ plan: 'workshop', status: 'active' }, 'training')).toBe(true);
    expect(isFeatureAvailable({ plan: 'workshop', status: 'active' }, 'moeAnalytics')).toBe(false);
    expect(isFeatureAvailable({ plan: 'factory', status: 'active' }, 'moeAnalytics')).toBe(true);
  });
});

describe('featureForPath', () => {
  it('maps gated module prefixes', () => {
    expect(featureForPath('/app/contractors/abc/edit')).toBe('contractors');
    expect(featureForPath('/app/shift/handover/create')).toBe('shiftHandover');
    expect(featureForPath('/app/training/my-modules')).toBe('training');
    expect(featureForPath('/app/safety/permits')).toBe('safety');
    expect(featureForPath('/app/moe')).toBe('moeAnalytics');
  });
  it('leaves other pages alone', () => {
    expect(featureForPath('/app/shift/my')).toBeNull();
    expect(featureForPath('/app/machines')).toBeNull();
    expect(featureForPath('/app/contractorsX')).toBeNull();
  });
});

describe('permanentAccess (permanent demo company)', () => {
  const demo = { plan: 'starter' as const, status: 'suspended', permanentAccess: true };
  it('has every feature, an enterprise effective plan, and is never trial-expired', async () => {
    const { hasPermanentAccess, effectivePlan, isFeatureAvailable, isTrialExpired } = await import('../planLimits');
    expect(hasPermanentAccess(demo)).toBe(true);
    expect(effectivePlan(demo)).toBe('enterprise');
    expect(isFeatureAvailable(demo, 'multiSite')).toBe(true);
    expect(isTrialExpired({ ...demo, status: 'trial', trialEndsAt: { toMillis: () => 1 } })).toBe(false);
  });
  it('does not change normal companies', async () => {
    const { effectivePlan, isFeatureAvailable } = await import('../planLimits');
    expect(effectivePlan({ plan: 'starter' })).toBe('starter');
    expect(isFeatureAvailable({ plan: 'starter', status: 'active' }, 'multiSite')).toBe(false);
  });
});
