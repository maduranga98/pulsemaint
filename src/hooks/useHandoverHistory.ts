import { useEffect } from 'react';
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

  useEffect(() => {
    void fetchHandoverHistory(filters);
  }, [fetchHandoverHistory, filters.dateFrom, filters.dateTo, filters.department, filters.shiftName, filters.supervisorName]);

  return { handoverHistory, refresh: () => fetchHandoverHistory(filters) };
}
