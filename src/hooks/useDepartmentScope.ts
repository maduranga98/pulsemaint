import { useAuthStore } from '../store/authStore';
import type { UserRole } from '../types/auth';

// Roles whose day-to-day views (Machines, Work Orders, Breakdowns, Reports)
// are limited to their own registered department. Every other role
// (admin, plant_manager, hr_officer, safety_officer, store_keeper) keeps
// full, department-wide visibility across their plant — unchanged.
const DEPARTMENT_SCOPED_ROLES = new Set<UserRole>(['technician', 'trainee', 'supervisor', 'floor_operator']);

// Plant is the main category, department its sub-category. Every role except
// admin is locked to their own registered plant; admin sees all plants (and,
// once a plant-tab selector is wired in, whichever plant they've picked).
const PLANT_SCOPED_ROLES = new Set<UserRole>([
  'plant_manager', 'supervisor', 'technician', 'store_keeper',
  'hr_officer', 'trainee', 'floor_operator', 'safety_officer',
]);

export interface DepartmentScope {
  /** The department to limit results to, or null when the current role isn't scoped (sees everything in-plant). */
  department: string | null;
  isScoped: boolean;
  /** The plant to limit results to, or null when the current role isn't plant-scoped (admin: sees all plants). */
  plantId: string | null;
  isPlantScoped: boolean;
}

/**
 * Resolves whether the signed-in user's role should only see data for their
 * own registered plant and/or department, and if so, which ones. Used to
 * filter Machines/Work Orders/Breakdowns/PM/Inventory/Training/Safety/
 * Reports lists and to restrict what a scoped role can create against —
 * never to change what data exists, only what's shown to that role.
 */
export function useDepartmentScope(): DepartmentScope {
  const userProfile = useAuthStore((s) => s.userProfile);
  const role = userProfile?.role;
  const isScoped = !!role && DEPARTMENT_SCOPED_ROLES.has(role);
  const isPlantScoped = !!role && PLANT_SCOPED_ROLES.has(role);
  return {
    department: isScoped ? (userProfile?.department ?? null) : null,
    isScoped,
    plantId: isPlantScoped ? (userProfile?.plantId ?? null) : null,
    isPlantScoped,
  };
}
