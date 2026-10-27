import { useAuthStore } from '../store/authStore';
import { isModuleEnabled } from '../lib/companyModules';

/**
 * Whether a switchable module (see `MODULE_SWITCHES`) is on for the signed-in user's company.
 * Dashboards and analytics use it to drop the widgets/KPIs of a module Lumora has turned off.
 */
export function useModuleEnabled(key: string): boolean {
  return useAuthStore((s) => isModuleEnabled(s.company, key));
}
