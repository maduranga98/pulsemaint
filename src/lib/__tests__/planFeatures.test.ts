import { describe, it, expect } from 'vitest';
import { isTrialExpired, isFeatureAvailable, featureForPath, seatCountsFrom, type PlanCompanyState } from '../planLimits';

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
  it('unlocks every feature during a running trial', () => {
    expect(isFeatureAvailable(trial(5), 'contractors')).toBe(true);
    expect(isFeatureAvailable(trial(5), 'audits')).toBe(true);
  });
  it('locks Starter features once the trial has ended', () => {
    expect(isFeatureAvailable(trial(-1), 'contractors')).toBe(false);
  });
  it('follows the plan matrix for active companies', () => {
    expect(isFeatureAvailable({ plan: 'starter', status: 'active' }, 'training')).toBe(false);
    expect(isFeatureAvailable({ plan: 'starter', status: 'active' }, 'kaizen')).toBe(false);
    expect(isFeatureAvailable({ plan: 'starter', status: 'active' }, 'purchaseOrders')).toBe(true);
    expect(isFeatureAvailable({ plan: 'starter', status: 'active' }, 'contractors')).toBe(false);
    expect(isFeatureAvailable({ plan: 'workshop', status: 'active' }, 'training')).toBe(true);
    expect(isFeatureAvailable({ plan: 'workshop', status: 'active' }, 'evaluations')).toBe(false);
    expect(isFeatureAvailable({ plan: 'factory', status: 'active' }, 'kaizen')).toBe(true);
    expect(isFeatureAvailable({ plan: 'workshop', status: 'active' }, 'purchaseOrders')).toBe(true);
    expect(isFeatureAvailable({ plan: 'workshop', status: 'active' }, 'analyticsReports')).toBe(true);
    expect(isFeatureAvailable({ plan: 'workshop', status: 'active' }, 'moeAnalytics')).toBe(false);
    expect(isFeatureAvailable({ plan: 'workshop', status: 'active' }, 'audits')).toBe(false);
    expect(isFeatureAvailable({ plan: 'factory', status: 'active' }, 'moeAnalytics')).toBe(true);
    expect(isFeatureAvailable({ plan: 'factory', status: 'active' }, 'advancedAnalytics')).toBe(true);
  });
});

describe('featureForPath', () => {
  it('maps gated module prefixes', () => {
    expect(featureForPath('/app/contractors/abc/edit')).toBe('contractors');
    expect(featureForPath('/app/shift/handover/create')).toBe('shiftHandover');
    expect(featureForPath('/app/training/my-modules')).toBe('training');
    expect(featureForPath('/app/safety/permits')).toBe('safety');
    expect(featureForPath('/app/kaizen')).toBe('kaizen');
    expect(featureForPath('/app/evaluations')).toBe('evaluations');
    expect(featureForPath('/app/moe')).toBe('moeAnalytics');
    expect(featureForPath('/app/inventory/purchase-orders/new')).toBe('purchaseOrders');
    expect(featureForPath('/app/analytics')).toBe('analyticsReports');
    expect(featureForPath('/app/reports/history')).toBe('analyticsReports');
    expect(featureForPath('/app/audit')).toBe('audits');
  });
  it('leaves other pages alone', () => {
    expect(featureForPath('/app/shift/my')).toBeNull();
    expect(featureForPath('/app/machines')).toBeNull();
    expect(featureForPath('/app/contractorsX')).toBeNull();
  });
});

describe('seatCountsFrom', () => {
  const NOW = 1_000_000;
  it('counts members and live invitations by seat type', () => {
    const r = seatCountsFrom({
      members: { all: 6, inactive: 0, light: 2, lightInactive: 0 },
      invites: [{ role: 'technician', expiresAtMs: NOW + 1 }, { role: 'trainee', expiresAtMs: null }],
    }, NOW);
    expect(r).toEqual({ full: 5, light: 3 });
  });
  it('deactivated users and expired invitations take no seat', () => {
    const r = seatCountsFrom({
      members: { all: 6, inactive: 2, light: 2, lightInactive: 1 },
      invites: [{ role: 'technician', expiresAtMs: NOW - 1 }, { role: 'floor_operator', expiresAtMs: NOW }, { role: 'supervisor', expiresAtMs: NOW + 5 }],
    }, NOW);
    // members: 4 active (1 light, 3 full); invitations: only the supervisor one is still valid
    expect(r).toEqual({ full: 4, light: 1 });
  });
});
