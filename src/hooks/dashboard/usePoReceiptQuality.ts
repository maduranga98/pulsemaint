import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';

export interface PoReceiptQualityPoint {
  condition: 'Good' | 'Damaged' | 'Wrong Item';
  quantity: number;
}

interface ReceivedLine {
  quantity?: number;
  condition?: string;
}

// PO receiving (ReceiveAgainstPo) writes one `po_notifications` doc per
// "Confirm Receipt" / "Resend Email" submission, split into `receivedItems`
// (condition 'good') and `issueItems` (condition 'damaged' | 'wrong_item') —
// that per-condition split isn't recorded anywhere else, so this is the only
// source for a rejected/damaged/faulty breakdown.
export function usePoReceiptQuality(companyId: string, windowDays: number = 30) {
  const [data, setData] = useState<PoReceiptQualityPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId) {
      setLoading(false);
      return;
    }

    const since = Timestamp.fromMillis(Date.now() - windowDays * 24 * 60 * 60 * 1000);
    const q = query(
      collection(db, 'po_notifications'),
      where('companyId', '==', companyId),
      where('event', '==', 'received'),
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const totals: Record<PoReceiptQualityPoint['condition'], number> = {
          Good: 0,
          Damaged: 0,
          'Wrong Item': 0,
        };

        snapshot.docs.forEach((d) => {
          const data = d.data();
          const createdAt = data.createdAt as Timestamp | undefined;
          if (!createdAt || createdAt.toMillis() < since.toMillis()) return;

          const receivedItems = (data.receivedItems as ReceivedLine[]) ?? [];
          const issueItems = (data.issueItems as ReceivedLine[]) ?? [];

          receivedItems.forEach((line) => {
            totals.Good += line.quantity ?? 0;
          });
          issueItems.forEach((line) => {
            if (line.condition === 'wrong_item') totals['Wrong Item'] += line.quantity ?? 0;
            else totals.Damaged += line.quantity ?? 0;
          });
        });

        setData(
          (['Good', 'Damaged', 'Wrong Item'] as const).map((condition) => ({
            condition,
            quantity: totals[condition],
          })),
        );
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [companyId, windowDays]);

  return { data, loading, error };
}
