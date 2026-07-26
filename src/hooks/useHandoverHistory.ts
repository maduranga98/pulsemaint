import { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import { subscribeHandoverHistory } from '@/services/handover.service';
import type { HandoverHistoryFilters, ShiftHandover } from '@/types/handover.types';

const defaultFilters: HandoverHistoryFilters = {
  dateFrom: null,
  dateTo: null,
  personName: '',
  role: '',
  shiftName: '',
  department: '',
  lateOnly: false,
};

export function useHandoverHistory(filters: HandoverHistoryFilters = defaultFilters) {
  const companyId = useAuthStore((s) => s.userProfile?.companyId);
  const [handoverHistory, setHandoverHistory] = useState<ShiftHandover[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    // Live company-wide handover history (all roles, all shifts).
    const unsub = subscribeHandoverHistory(
      companyId,
      filters,
      (rows) => {
        setHandoverHistory(rows);
        setLoading(false);
      },
      (message) => {
        setError(message);
        setLoading(false);
      },
    );
    return () => unsub();
  }, [companyId, filters.dateFrom, filters.dateTo]);

  return { handoverHistory, loading, error, refresh: () => {} };
}
