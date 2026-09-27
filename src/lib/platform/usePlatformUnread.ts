import { useEffect, useRef, useState } from 'react';
import { subscribeLumoraUnread, type SupportRequest } from '@/services/supportRequestsService';
import { playNotificationSound, showDeviceNotification } from '@/lib/notifications/deviceNotify';

/**
 * Superadmins: company requests with something new for Lumora (new request
 * or a company reply). New arrivals after the first load play the
 * notification sound and raise a desktop notification.
 */
export function usePlatformUnread(enabled: boolean): SupportRequest[] {
  const [rows, setRows] = useState<SupportRequest[]>([]);
  const seen = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (!enabled) {
      setRows([]);
      seen.current = null;
      return undefined;
    }
    return subscribeLumoraUnread((next) => {
      setRows(next);
      const key = (r: SupportRequest) => `${r.id}:${r.lastMessageAt?.toMillis?.() ?? r.createdAt?.toMillis?.() ?? ''}`;
      const keys = new Set(next.map(key));
      if (seen.current === null) {
        seen.current = keys;
        return;
      }
      const fresh = next.filter((r) => !seen.current!.has(key(r)));
      seen.current = keys;
      if (!fresh.length) return;
      playNotificationSound();
      for (const r of fresh.slice(0, 3)) {
        showDeviceNotification('FirmiCore platform', {
          body: `${r.companyName}: ${r.subject}`,
          tag: r.id,
          onClick: () => window.location.assign(`/platform/requests/${r.id}`),
        });
      }
    });
  }, [enabled]);

  return rows;
}
