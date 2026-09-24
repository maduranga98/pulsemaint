import { useState, useEffect, useCallback } from 'react';
import { computeCostByWoType, type MonthArg } from '../../services/analyticsAggregation';
import { useDepartmentScope } from '../useDepartmentScope';

export interface CostByWoTypeRow {
  woType: string;
  cost: number;
}

export function useCostByWoType(companyId: string, month: MonthArg) {
  // Plant-scoped roles / admin's plant tab only see their plant's figures.
  const { plantId } = useDepartmentScope();
  const [data, setData] = useState<CostByWoTypeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // A new array reference each render would loop the effect — key off its
  // contents instead.
  const monthKey = Array.isArray(month) ? month.join(',') : month;

  const fetch = useCallback(async () => {
    if (!companyId || !monthKey) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await computeCostByWoType(companyId, month, plantId);
      setData(result);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, monthKey, plantId]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { data, loading, error, refetch: fetch };
}
