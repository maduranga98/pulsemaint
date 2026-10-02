import type { UserRole } from '@/types/auth';

/**
 * Roles that work across the whole plant (or company) rather than inside one
 * department, so a department is never asked for or stored when inviting them.
 */
const ROLES_WITHOUT_DEPARTMENT: ReadonlySet<UserRole> = new Set<UserRole>([
  'admin',
  'plant_manager',
  'store_keeper',
  'hr_officer',
  'safety_officer',
]);

export function roleHasDepartment(role: UserRole): boolean {
  return !ROLES_WITHOUT_DEPARTMENT.has(role);
}

/** The department to save for this role — always null for roles that don't have one. */
export function departmentForRole(role: UserRole, department: string | null | undefined): string | null {
  if (!roleHasDepartment(role)) return null;
  return department?.trim() || null;
}
