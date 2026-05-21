import { useState, useEffect, useCallback } from 'react';
import { fetchDailyAnalytics, getDateRange } from '../../services/analytics.service';
import type { AnalyticsDaily, ChartDateRange } from '../../types/analytics.types';

export function useBreakdownTrend(companyId: string, range: ChartDateRange) {
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
      const result = await fetchDailyAnalytics(companyId, from, to);
      setData(result);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [companyId, range]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { data, loading, error, refetch: fetch };
}
