import { useState, useEffect, useCallback } from 'react';
import { computeCostByWoType } from '../../services/analyticsAggregation';

export interface CostByWoTypeRow {
  woType: string;
  cost: number;
}

export function useCostByWoType(companyId: string, month: string) {
  const [data, setData] = useState<CostByWoTypeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!companyId || !month) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await computeCostByWoType(companyId, month);
      setData(result);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [companyId, month]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { data, loading, error, refetch: fetch };
}
