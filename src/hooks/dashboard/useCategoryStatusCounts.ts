import { useState, useEffect, useCallback } from 'react';
import type { CategoryStatusRow, DateRange } from '../../services/teamPerformance.service';

export type { CategoryStatusRow };

export function useCategoryStatusCounts(
  companyId: string,
  fetcher: (companyId: string, dateRange?: DateRange | null) => Promise<CategoryStatusRow[]>,
  dateRange?: DateRange | null,
) {
  const [data, setData] = useState<CategoryStatusRow[]>([]);
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
