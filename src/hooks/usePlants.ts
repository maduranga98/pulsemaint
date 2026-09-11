import { useEffect, useState } from 'react';
import { subscribePlants } from '../services/plants.service';
import type { Plant } from '../types/plant';

export function usePlants(companyId: string) {
  const [plants, setPlants] = useState<Plant[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsub = subscribePlants(
      companyId,
      (p) => {
        setPlants(p);
        setLoading(false);
      },
      () => setLoading(false),
    );
    return unsub;
  }, [companyId]);

  const activePlants = plants.filter((p) => p.status === 'active');

  return { plants, activePlants, loading };
}
