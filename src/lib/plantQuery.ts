import { where, type QueryConstraint } from 'firebase/firestore';
import { useAuthStore } from '../store/authStore';

/**
 * Plant isolation on the server: firestore.rules let a plant-scoped user read
 * only their own plant's machines, work orders, breakdown tickets, PM
 * schedules / history and notifications. Rules are not filters — a list
 * query that could match another plant's documents is rejected as a whole —
 * so every list query on these collections carries the plant constraint
 * below for such users.
 */

/** The field each plant-scoped collection records its plant in. */
export const PLANT_FIELDS = {
  machines: 'plantId',
  workOrders: 'machinePlantId',
  breakdown_tickets: 'machinePlantId',
  pm_schedules: 'plantId',
  pm_history: 'machinePlantId',
  notifications: 'plantId',
} as const;

export type PlantScopedCollection = keyof typeof PLANT_FIELDS;

/** Collections whose reads are also narrowed by department (see departmentIsolationOn in firestore.rules). */
const DEPARTMENT_FIELDS = {
  workOrders: 'machineDepartment',
  breakdown_tickets: 'machineDepartment',
} as const;

const DEPARTMENT_SCOPED_ROLES = new Set(['technician', 'trainee', 'supervisor', 'floor_operator']);

/**
 * The department the rules confine the signed-in user to, or null when
 * department isolation is off for their company, their role isn't
 * department-scoped, or they have no registered department. Mirrors
 * departmentIsolationOn() in firestore.rules.
 */
export function rulesDepartment(): string | null {
  const { userProfile, company } = useAuthStore.getState();
  if (!userProfile || !company?.departmentIsolation) return null;
  if (!DEPARTMENT_SCOPED_ROLES.has(userProfile.role)) return null;
  return userProfile.department?.trim() ? userProfile.department : null;
}

/**
 * The plant the rules confine the signed-in user to: their own registered
 * plant, or null when they're unrestricted (admin — whatever plant tab they
 * have selected — or a user without a plant). Mirrors myPlantId() /
 * plantVisible() in firestore.rules.
 */
export function rulesPlantId(): string | null {
  const profile = useAuthStore.getState().userProfile;
  if (!profile || profile.role === 'admin') return null;
  return profile.plantId ?? null;
}

/**
 * `where(<plant field> == <my plant>)` for a plant-scoped user, nothing for an
 * unrestricted one — spread it into every list query on these collections.
 * Work orders and breakdown tickets also get `where(machineDepartment == <my
 * department>)` when the company has department isolation on and the user's
 * role is department-scoped. Collections without a plant field
 * (contractorJobs …) get nothing.
 */
export function plantConstraints(collectionName: string): QueryConstraint[] {
  const constraints: QueryConstraint[] = [];
  const field = (PLANT_FIELDS as Record<string, string>)[collectionName];
  const plantId = rulesPlantId();
  if (field && plantId) constraints.push(where(field, '==', plantId));
  const deptField = (DEPARTMENT_FIELDS as Record<string, string>)[collectionName];
  const department = rulesDepartment();
  if (deptField && department) constraints.push(where(deptField, '==', department));
  return constraints;
}
