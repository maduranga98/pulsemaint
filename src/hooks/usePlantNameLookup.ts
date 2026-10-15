import { useCallback } from 'react';
import { useAuthStore } from '../store/authStore';
import { useDepartmentScope } from './useDepartmentScope';
import { usePlants } from './usePlants';

/**
 * `(plantId) => plant name | null`, for tagging dashboard rows with the plant
 * they came from. Returns null whenever a single plant is already in scope
 * (a plant-scoped role, or admin with a plant tab selected) — the plant is
 * then obvious, so only the "All Plants" view labels its rows.
 */
export function usePlantNameLookup() {
  const companyId = useAuthStore((s) => s.userProfile?.companyId) ?? '';
  const { plantId } = useDepartmentScope();
  const { plants } = usePlants(companyId);

  return useCallback(
    (recordPlantId?: string | null): string | null => {
      if (plantId || !recordPlantId) return null;
      return plants.find((p) => p.id === recordPlantId)?.name ?? null;
    },
    [plantId, plants],
  );
}
