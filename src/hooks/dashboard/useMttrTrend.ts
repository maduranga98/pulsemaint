import { useState, useEffect, useCallback } from 'react';
import { fetchDailyAnalytics, getDateRange } from '../../services/analytics.service';
import type { AnalyticsDaily, ChartDateRange } from '../../types/analytics.types';
import { useDepartmentScope } from '../useDepartmentScope';

export function useMttrTrend(companyId: string, range: ChartDateRange) {
  // Plant-scoped roles / admin's plant tab only see their plant's figures.
  const { plantId } = useDepartmentScope();
  const [data, setData] = useState<AnalyticsDaily[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { from, to } = getDateRange(range);
      const result = await fetchDailyAnalytics(companyId, from, to, plantId);
      setData(result);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [companyId, range, plantId]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { data, loading, error, refetch: fetch };
}
