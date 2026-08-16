import { useState, useEffect, useCallback } from 'react';
import { fetchTopPerformers, type TopPerformerRow } from '../../services/teamPerformance.service';

export type { TopPerformerRow };

export function useTopPerformers(companyId: string) {
  const [data, setData] = useState<TopPerformerRow[]>([]);
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
      setData(await fetchTopPerformers(companyId));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { data, loading, error, refetch: fetch };
}
