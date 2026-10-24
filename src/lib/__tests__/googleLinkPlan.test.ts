import { describe, it, expect } from 'vitest';
import fs from 'node:fs';

// functions/src/auth/googleLinkPlan.js decides what happens when a Google login has no company yet.
function load() {
  const src = fs.readFileSync('functions/src/auth/googleLinkPlan.js', 'utf8');
  const mod: { exports: Record<string, any> } = { exports: {} };
  new Function('module', 'exports', src)(mod, mod.exports);
  return mod.exports.planGoogleLink as (f: Record<string, unknown>) => { action: string; reason?: string; deleteGoogleLogin?: boolean };
}
const planGoogleLink = load();

const now = Date.now();
const base = {
  googleHasCompany: false,
  googleEmailVerified: true,
  googleProviders: ['google.com'],
  googleCreatedMs: now - 60_000,
  nowMs: now,
  registered: { uid: 'U', sameAsGoogle: false, hasGoogleLinked: false, isSuperadmin: false, companyId: 'c1', inactive: false },
};

describe('planGoogleLink', () => {
  it('does nothing when the Google login already belongs to a company', () => {
    expect(planGoogleLink({ ...base, googleHasCompany: true }).action).toBe('ready');
  });
  it('links a fresh Google login to the registered login with the same email', () => {
    expect(planGoogleLink(base)).toEqual({ action: 'link' });
  });
  it('refuses an email that never registered, and removes the stray fresh Google login', () => {
    expect(planGoogleLink({ ...base, registered: null })).toMatchObject({ action: 'reject', reason: 'not-registered', deleteGoogleLogin: true });
    expect(planGoogleLink({ ...base, registered: { ...base.registered, companyId: null } })).toMatchObject({ reason: 'not-registered' });
    expect(planGoogleLink({ ...base, registered: { ...base.registered, sameAsGoogle: true } })).toMatchObject({ reason: 'not-registered' });
  });
  it('refuses an email Google has not verified', () => {
    expect(planGoogleLink({ ...base, googleEmailVerified: false })).toMatchObject({ action: 'reject', reason: 'unverified-email' });
  });
  it('never links platform, deactivated or already-linked accounts', () => {
    expect(planGoogleLink({ ...base, registered: { ...base.registered, isSuperadmin: true } })).toMatchObject({ reason: 'platform-account' });
    expect(planGoogleLink({ ...base, registered: { ...base.registered, inactive: true } })).toMatchObject({ reason: 'inactive' });
    expect(planGoogleLink({ ...base, registered: { ...base.registered, hasGoogleLinked: true } })).toMatchObject({ reason: 'already-linked' });
  });
  it('only deletes or folds in a Google login made minutes ago with Google as its only provider', () => {
    const old = planGoogleLink({ ...base, googleCreatedMs: now - 3_600_000 });
    expect(old).toMatchObject({ action: 'reject', reason: 'not-fresh', deleteGoogleLogin: false });
    const multi = planGoogleLink({ ...base, googleProviders: ['google.com', 'password'], registered: null });
    expect(multi).toMatchObject({ reason: 'not-registered', deleteGoogleLogin: false });
  });
});
