import { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import { subscribeCompanyUnreadCount } from '@/services/supportRequestsService';

/** Company admins: requests with an unread reply / status change from the FirmiCore team. */
export function useSupportUnreadCount(): number {
  const companyId = useAuthStore((s) => s.userProfile?.companyId);
  const isAdmin = useAuthStore((s) => s.userProfile?.role === 'admin');
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!companyId || !isAdmin) {
      setCount(0);
      return undefined;
    }
    return subscribeCompanyUnreadCount(companyId, setCount);
  }, [companyId, isAdmin]);

  return count;
}
