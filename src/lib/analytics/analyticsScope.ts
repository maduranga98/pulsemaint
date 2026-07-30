import type { UserProfile } from '../../types/auth';
import { OVERSIGHT_ROLES } from '../notifications/recipients';

/**
 * Roles that read the company-wide Analytics page (the same charts admins and
 * plant managers see): supervisors get the full-plant view too. Scoping them
 * by a `siteIds[0]` that differs from their companyId made queries filtered by
 * `companyId` come back empty — e.g. the Maintenance Cost Overview and Work
 * Order distribution showed no data.
 */
const COMPANY_SCOPED_ANALYTICS_ROLES = new Set<UserProfile['role']>([
  ...OVERSIGHT_ROLES,
  'supervisor',
]);

/**
 * The id every analytics / dashboard query is scoped by.
 *
 * Most roles are scoped to the site they work on. The company-wide analytics
 * roles (admin, plant_manager, supervisor) are responsible for/read the whole
 * plant, so they are scoped to the company instead — otherwise a user whose
 * profile happens to carry a `siteIds[0]` saw a narrower (often empty) slice
 * of the same dashboard than one whose profile does not.
 */
export function resolveAnalyticsScopeId(
  profile: Pick<UserProfile, 'role' | 'companyId' | 'siteIds'> | null | undefined,
): string {
  if (!profile) return '';
  if (COMPANY_SCOPED_ANALYTICS_ROLES.has(profile.role)) return profile.companyId ?? '';
  return profile.siteIds?.[0] || profile.companyId || '';
}
