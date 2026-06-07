import { useState, useEffect } from 'react';
import { subscribeMachineHealth } from '../../services/analytics.service';
import type { MachineHealthDoc } from '../../types/analytics.types';

export function useMtbfPerMachine(companyId: string) {
  const [machines, setMachines] = useState<MachineHealthDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsubscribe = subscribeMachineHealth(companyId, (data) => {
      setMachines(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [companyId]);

  return { machines, loading, error };
}
