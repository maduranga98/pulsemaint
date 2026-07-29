import { describe, it, expect } from 'vitest';
import { resolveAnalyticsScopeId } from '../analytics/analyticsScope';
import type { UserProfile } from '../../types/auth';

type ScopeProfile = Pick<UserProfile, 'role' | 'companyId' | 'siteIds'>;

const profile = (role: UserProfile['role'], siteIds: string[] = []): ScopeProfile =>
  ({ role, companyId: 'company-1', siteIds }) as ScopeProfile;

describe('resolveAnalyticsScopeId', () => {
  it('scopes admin and plant_manager to the whole company', () => {
    expect(resolveAnalyticsScopeId(profile('admin', ['site-a']))).toBe('company-1');
    expect(resolveAnalyticsScopeId(profile('plant_manager', ['site-b']))).toBe('company-1');
  });

  it('gives admin and plant_manager the same scope even with different site lists', () => {
    // This is the whole point: the two roles must report the same numbers for
    // the same plant, whatever their profiles happen to carry.
    expect(resolveAnalyticsScopeId(profile('admin', []))).toBe(
      resolveAnalyticsScopeId(profile('plant_manager', ['site-b', 'site-c'])),
    );
  });

  it('scopes every other role to their first site', () => {
    expect(resolveAnalyticsScopeId(profile('supervisor', ['site-a']))).toBe('site-a');
    expect(resolveAnalyticsScopeId(profile('technician', ['site-x', 'site-y']))).toBe('site-x');
  });

  it('falls back to the company when a site-scoped role has no site', () => {
    expect(resolveAnalyticsScopeId(profile('supervisor', []))).toBe('company-1');
  });

  it('returns an empty string with no profile', () => {
    expect(resolveAnalyticsScopeId(null)).toBe('');
    expect(resolveAnalyticsScopeId(undefined)).toBe('');
  });
});
