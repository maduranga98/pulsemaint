import { useState, useEffect, useCallback } from 'react';
import { fetchMonthlyAnalytics } from '../../services/analytics.service';
import type { AnalyticsMonthly } from '../../types/analytics.types';
import { useDepartmentScope } from '../useDepartmentScope';

export function useMaintenanceCostTrend(companyId: string, month: string) {
  // Plant-scoped roles / admin's plant tab only see their plant's figures.
  const { plantId } = useDepartmentScope();
  const [data, setData] = useState<AnalyticsMonthly | null>(null);
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
      const result = await fetchMonthlyAnalytics(companyId, month, plantId);
      setData(result);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [companyId, month, plantId]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { data, loading, error, refetch: fetch };
}
