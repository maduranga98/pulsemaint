import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { PLAN_LIMITS, ENTERPRISE_TIER_LIMITS, limitsForCompany, type Plan } from '../planLimits';

// The Cloud Functions keep their own copy of the plan limits (functions/src/lib/planFeatures.js). This makes
// sure the two copies cannot drift apart: every count limit, tier, override rule and feature flag must match.
function loadServer() {
  const src = fs.readFileSync('functions/src/lib/planFeatures.js', 'utf8');
  const mod: { exports: Record<string, any> } = { exports: {} };
  const stub = (n: string) => (n.startsWith('firebase-admin') ? { getFirestore: () => ({}) } : (() => { throw new Error(n); })());
  new Function('require', 'module', 'exports', src)(stub, mod, mod.exports);
  return mod.exports as {
    countLimit: (c: unknown, k: string) => number | null;
    featureAvailable: (c: unknown, f: string, now?: number) => boolean;
    aiCreditsLimit: (c: unknown) => number | null;
  };
}

const KEYS = ['fullUsers', 'lightUsers', 'plants', 'machines', 'inventoryItems', 'pmSchedules'] as const;
const server = loadServer();
const plans: Plan[] = ['starter', 'workshop', 'factory', 'enterprise'];

describe('server plan limits mirror the client', () => {
  it('count limits per plan', () => {
    for (const p of plans) for (const k of KEYS) expect(server.countLimit({ plan: p, status: 'active' }, k), `${p}.${k}`).toBe(PLAN_LIMITS[p][k]);
  });
  it('enterprise tiers', () => {
    for (const [tier, lim] of Object.entries(ENTERPRISE_TIER_LIMITS)) {
      for (const k of KEYS) expect(server.countLimit({ plan: 'enterprise', enterpriseTier: tier, status: 'active' }, k), `${tier}.${k}`).toBe(lim[k]);
    }
  });
  it('overrides, including the legacy users key and bad values', () => {
    const cases: Array<Record<string, unknown>> = [
      { machines: 40 }, { machines: null }, { machines: -5 }, { machines: Number.NaN }, { users: 7 }, { fullUsers: 9 }, { machines: 0 }, { bogus: 3 },
    ];
    for (const limitOverrides of cases) {
      for (const k of KEYS) {
        const company = { plan: 'starter', status: 'active', limitOverrides };
        expect(server.countLimit(company, k), `${JSON.stringify(limitOverrides)} ${k}`).toBe(limitsForCompany(company as never)[k]);
      }
    }
  });
  it('a running trial is limited like Starter', () => {
    expect(server.countLimit({ plan: 'factory', status: 'trial' }, 'machines')).toBe(PLAN_LIMITS.starter.machines);
    expect(server.countLimit(null, 'machines')).toBe(PLAN_LIMITS.starter.machines);
  });
  it('server-side features and AI credits', () => {
    for (const p of plans) {
      const c = { plan: p, status: 'active' };
      for (const f of ['autoPOEmail', 'qrLowStockAlerts', 'aiAssist', 'analyticsReports', 'advancedAnalytics'] as const) {
        expect(server.featureAvailable(c, f), `${p}.${f}`).toBe(PLAN_LIMITS[p].features[f]);
      }
      expect(server.aiCreditsLimit(c), `${p} AI credits`).toBe(PLAN_LIMITS[p].aiCreditsPerMonth);
    }
  });
});
