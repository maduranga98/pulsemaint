import { useEffect } from 'react';
import { useHandoverStore } from '@/store/handover.store';
import { useAuthStore } from '@/store/authStore';

export function usePendingHandover() {
  const companyId = useAuthStore((state) => state.userProfile?.companyId);
  const pendingHandover = useHandoverStore((state) => state.pendingHandover);
  const hasPendingHandover = useHandoverStore((state) => state.hasPendingHandover);
  const fetchPendingHandover = useHandoverStore((state) => state.fetchPendingHandover);

  useEffect(() => {
    if (companyId) void fetchPendingHandover();
  }, [companyId, fetchPendingHandover]);

  return { pendingHandover, hasPendingHandover, refresh: fetchPendingHandover };
}
