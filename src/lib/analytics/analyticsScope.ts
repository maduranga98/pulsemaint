import type { UserProfile } from '../../types/auth';
import { OVERSIGHT_ROLES } from '../notifications/recipients';

/**
 * The id every analytics / dashboard query is scoped by.
 *
 * Most roles are scoped to the site they work on. The oversight roles (admin,
 * plant_manager) are responsible for the whole plant, so they are scoped to
 * the company instead — otherwise a plant manager whose profile happens to
 * carry a `siteIds[0]` saw a narrower slice of the same dashboard than an
 * admin whose profile does not, and the two roles reported different numbers
 * for the same plant.
 */
export function resolveAnalyticsScopeId(
  profile: Pick<UserProfile, 'role' | 'companyId' | 'siteIds'> | null | undefined,
): string {
  if (!profile) return '';
  if (OVERSIGHT_ROLES.includes(profile.role)) return profile.companyId ?? '';
  return profile.siteIds?.[0] || profile.companyId || '';
}
