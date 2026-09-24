import { useCallback } from 'react';
import { useDepartmentScope } from './useDepartmentScope';
import { usePlantUserIds } from './usePlantUserIds';
import { useAuthStore } from '../store/authStore';

/**
 * One predicate for "does this record belong to the plant I'm scoped to?"
 * (plant-scoped roles: their own plant; admin: the selected plant tab, or
 * everything on "All Plants").
 *
 * A record matches on its own `plantId` when it carries one; records that
 * predate plant stamping (or that are person-owned, like POs and parts
 * requests) fall back to whether the person behind them — requester,
 * raiser, trainee — is registered under the plant.
 */
export function usePlantFilter(companyId: string | undefined) {
  const { plantId } = useDepartmentScope();
  const plantUserIds = usePlantUserIds(companyId);
  // Frontline roles can't read the company roster, so their own records are
  // matched directly (a person always belongs to their own plant).
  const myId = useAuthStore((s) => s.userProfile?.id);

  const inPlant = useCallback(
    (recordPlantId?: string | null, personId?: string | null): boolean => {
      if (!plantId) return true;
      if (recordPlantId) return recordPlantId === plantId;
      if (!personId) return false;
      if (personId === myId) return true;
      return !!plantUserIds && plantUserIds.has(personId);
    },
    [plantId, plantUserIds, myId],
  );

  return { plantId, plantUserIds, inPlant, isPlantScoped: plantId !== null };
}
