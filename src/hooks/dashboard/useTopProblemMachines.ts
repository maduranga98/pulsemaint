import { useState, useEffect } from 'react';
import { subscribeMonthlyAnalytics, type MonthArg } from '../../services/analyticsAggregation';
import type { AnalyticsMonthly } from '../../types/analytics.types';

export function useTopProblemMachines(companyId: string, month: MonthArg) {
  const [data, setData] = useState<AnalyticsMonthly | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Bump to force the live subscription to tear down and re-establish.
  const [nonce, setNonce] = useState(0);
  const monthKey = Array.isArray(month) ? month.join(',') : month;

  useEffect(() => {
    if (!companyId || !monthKey) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    let cancelled = false;
    const unsub = subscribeMonthlyAnalytics(companyId, month, (result) => {
      if (cancelled) return;
      setData(result);
      setLoading(false);
    });
    return () => {
      cancelled = true;
      unsub();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, monthKey, nonce]);

  return { data, loading, error, refetch: () => setNonce((n) => n + 1) };
}
