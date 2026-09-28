import { useEffect, useRef, useState } from 'react';
import { collection, doc, limit, onSnapshot, query, updateDoc, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { playNotificationSound, showDeviceNotification } from '@/lib/notifications/deviceNotify';

export interface PaymentAlert {
  id: string;
  companyName: string | null;
  amount: number;
  currency: string;
}

/**
 * Superadmins: unread "FirmiCore payment received" alerts (written by the
 * Stripe webhook). New ones after the first load play the notification sound
 * and raise a desktop notification.
 */
export function usePaymentAlerts(enabled: boolean): PaymentAlert[] {
  const [rows, setRows] = useState<PaymentAlert[]>([]);
  const seen = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (!enabled) {
      setRows([]);
      seen.current = null;
      return undefined;
    }
    return onSnapshot(
      query(collection(db, 'platformNotifications'), where('type', '==', 'payment'), where('read', '==', false), limit(100)),
      (snap) => {
        const next = snap.docs.map((d) => ({ id: d.id, companyName: d.get('companyName') ?? null, amount: d.get('amount') ?? 0, currency: d.get('currency') ?? 'usd' }));
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
          const amount = new Intl.NumberFormat('en-US', { style: 'currency', currency: r.currency.toUpperCase() }).format(r.amount / 100);
          showDeviceNotification('FirmiCore payment received', {
            body: `${r.companyName ?? 'A company'} paid ${amount}`,
            tag: r.id,
            onClick: () => window.location.assign('/platform/payments'),
          });
        }
      },
      () => setRows([]),
    );
  }, [enabled]);

  return rows;
}

export function markPaymentAlertsRead(ids: string[]) {
  return Promise.all(ids.map((id) => updateDoc(doc(db, 'platformNotifications', id), { read: true }).catch(() => {})));
}
