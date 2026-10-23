import { useAuthStore } from '../store/authStore';
import { usePlants } from './usePlants';

/**
 * Whether the company has any active plant. A company without plants never
 * needs a plant picker, filter or plant name — those stay hidden until the
 * first plant is added (Settings → Plants). False while plants are loading,
 * so a plant-less company never sees the fields flash up.
 */
export function usePlantsInUse(): boolean {
  const companyId = useAuthStore((s) => s.userProfile?.companyId ?? '');
  const { activePlants, loading } = usePlants(companyId);
  return !loading && activePlants.length > 0;
}
