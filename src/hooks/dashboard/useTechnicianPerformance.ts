import { useState, useEffect, useCallback } from 'react';
import { fetchMonthlyAnalytics } from '../../services/analytics.service';
import { computeMonthlyAnalytics, type MonthArg } from '../../services/analyticsAggregation';
import type { AnalyticsMonthly } from '../../types/analytics.types';
import { useDepartmentScope } from '../useDepartmentScope';

export function useTechnicianPerformance(companyId: string, month: MonthArg) {
  // Plant-scoped roles / admin's plant tab only see their plant's figures.
  const { plantId } = useDepartmentScope();
  const [data, setData] = useState<AnalyticsMonthly | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const monthKey = Array.isArray(month) ? month.join(',') : month;

  const fetch = useCallback(async () => {
    if (!companyId || !monthKey) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      let result = await fetchMonthlyAnalytics(companyId, month, plantId);
      if (!result || result.technicianPerformance.length === 0) {
        // No completed WOs recorded in the selected month yet — fall back to
        // the all-time aggregation so the panel still shows live data.
        result = await computeMonthlyAnalytics(companyId, 'all', plantId);
      }
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
