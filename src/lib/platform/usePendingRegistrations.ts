import { useEffect, useRef, useState } from 'react';
import { collection, limit, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { playNotificationSound, showDeviceNotification } from '@/lib/notifications/deviceNotify';

export interface PendingRegistration {
  id: string;
  companyId: string;
  companyName: string | null;
}

/**
 * Superadmins: companies that registered and are waiting for approval
 * (unread "registration" alerts written by onCompanyRegistered, marked read
 * when the company is approved or rejected). A new one after the first load
 * plays the notification sound and raises a desktop notification.
 */
export function usePendingRegistrations(enabled: boolean): PendingRegistration[] {
  const [rows, setRows] = useState<PendingRegistration[]>([]);
  const seen = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (!enabled) {
      setRows([]);
      seen.current = null;
      return undefined;
    }
    return onSnapshot(
      query(collection(db, 'platformNotifications'), where('type', '==', 'registration'), where('read', '==', false), limit(100)),
      (snap) => {
        const next = snap.docs.map((d) => ({ id: d.id, companyId: d.get('companyId') ?? '', companyName: d.get('companyName') ?? null }));
        setRows(next);
        const ids = new Set(next.map((r) => r.id));
        if (seen.current === null) {
          seen.current = ids;
          return;
        }
        const fresh = next.filter((r) => !seen.current!.has(r.id));
        seen.current = ids;
        if (!fresh.length) return;
        playNotificationSound();
        for (const r of fresh.slice(0, 3)) {
          showDeviceNotification('New FirmiCore registration', {
            body: `${r.companyName ?? 'A company'} is waiting for approval`,
            tag: r.id,
            onClick: () => window.location.assign(`/platform/companies/${r.companyId}`),
          });
        }
      },
      () => setRows([]),
    );
  }, [enabled]);

  return rows;
}
