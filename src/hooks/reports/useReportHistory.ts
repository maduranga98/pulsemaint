import { useEffect } from 'react';
import { useReportsStore } from '../../store/reports.store';

export function useReportHistory() {
  const reportHistory = useReportsStore((state) => state.reportHistory);
  const historyLoading = useReportsStore((state) => state.historyLoading);
  const historyFilters = useReportsStore((state) => state.historyFilters);
  const fetchReportHistory = useReportsStore((state) => state.fetchReportHistory);
  const deleteReportHistory = useReportsStore((state) => state.deleteReportHistory);
  const updateHistoryFilters = useReportsStore((state) => state.updateHistoryFilters);

  useEffect(() => {
    void fetchReportHistory();
  }, [fetchReportHistory, historyFilters]);

  return {
    reportHistory,
    historyLoading,
    historyFilters,
    updateHistoryFilters,
    deleteReportHistory,
    refetch: fetchReportHistory,
  };
}
