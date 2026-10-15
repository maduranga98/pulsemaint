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
 * Collections without a plant field (contractorJobs …) get nothing.
 */
export function plantConstraints(collectionName: string): QueryConstraint[] {
  const field = (PLANT_FIELDS as Record<string, string>)[collectionName];
  const plantId = rulesPlantId();
  return field && plantId ? [where(field, '==', plantId)] : [];
}
