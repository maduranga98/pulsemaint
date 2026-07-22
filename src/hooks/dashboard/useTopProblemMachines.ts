import { useState, useEffect } from 'react';
import { subscribeMonthlyAnalytics } from '../../services/analyticsAggregation';
import type { AnalyticsMonthly } from '../../types/analytics.types';

export function useTopProblemMachines(companyId: string, month: string) {
  const [data, setData] = useState<AnalyticsMonthly | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Bump to force the live subscription to tear down and re-establish.
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!companyId || !month) {
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
  }, [companyId, month, nonce]);

  return { data, loading, error, refetch: () => setNonce((n) => n + 1) };
}
