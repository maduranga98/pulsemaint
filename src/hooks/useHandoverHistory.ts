import { useEffect, useState } from 'react';
import { useHandoverStore } from '@/store/handover.store';
import type { HandoverHistoryFilters } from '@/types/handover.types';

const defaultFilters: HandoverHistoryFilters = {
  dateFrom: null,
  dateTo: null,
  supervisorName: '',
  shiftName: '',
  department: '',
};

export function useHandoverHistory(filters: HandoverHistoryFilters = defaultFilters) {
  const handoverHistory = useHandoverStore((state) => state.handoverHistory);
  const fetchHandoverHistory = useHandoverStore((state) => state.fetchHandoverHistory);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchHandoverHistory(filters)
      .catch((err) => {
        if (!cancelled) {
          console.error('useHandoverHistory: fetch failed', err);
          setError(err instanceof Error ? err.message : 'Failed to load handover history.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fetchHandoverHistory, filters.dateFrom, filters.dateTo, filters.department, filters.shiftName, filters.supervisorName]);

  return { handoverHistory, loading, error, refresh: () => fetchHandoverHistory(filters) };
}
