import { useState, useEffect, useCallback } from 'react';
import type { CategoryCountRow, DateRange } from '../../services/teamPerformance.service';

export type { CategoryCountRow };

export function useCategoryCounts(
  companyId: string,
  fetcher: (companyId: string, dateRange?: DateRange | null) => Promise<CategoryCountRow[]>,
  dateRange?: DateRange | null,
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
      setData(await fetcher(companyId, dateRange));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [companyId, fetcher, dateRange?.from, dateRange?.to]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { data, loading, error, refetch: fetch };
}
