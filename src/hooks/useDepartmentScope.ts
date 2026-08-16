import { useAuthStore } from '../store/authStore';
import type { UserRole } from '../types/auth';

// Roles whose day-to-day views (Machines, Work Orders, Breakdowns, Reports)
// are limited to their own registered department. Every other role
// (admin, plant_manager, hr_officer, safety_officer, store_keeper) keeps
// full, company-wide visibility across all departments — unchanged.
const DEPARTMENT_SCOPED_ROLES = new Set<UserRole>(['technician', 'trainee', 'supervisor', 'floor_operator']);

export interface DepartmentScope {
  /** The department to limit results to, or null when the current role isn't scoped (sees everything). */
  department: string | null;
  isScoped: boolean;
}

/**
 * Resolves whether the signed-in user's role should only see data for their
 * own registered department, and if so, which department that is. Used to
 * filter Machines/Work Orders/Breakdowns/Reports lists and to restrict which
 * machines a scoped role can create a Work Order against — never to change
 * what data exists, only what's shown to that role.
 */
export function useDepartmentScope(): DepartmentScope {
  const userProfile = useAuthStore((s) => s.userProfile);
  const isScoped = !!userProfile?.role && DEPARTMENT_SCOPED_ROLES.has(userProfile.role);
  return {
    department: isScoped ? (userProfile?.department ?? null) : null,
    isScoped,
  };
}
