import { useState, useEffect, useCallback } from 'react';
import type { CategoryCountRow } from '../../services/teamPerformance.service';

export type { CategoryCountRow };

export function useCategoryCounts(
  companyId: string,
  fetcher: (companyId: string) => Promise<CategoryCountRow[]>,
) {
  const [data, setData] = useState<CategoryCountRow[]>([]);
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
      setData(await fetcher(companyId));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [companyId, fetcher]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { data, loading, error, refetch: fetch };
}
