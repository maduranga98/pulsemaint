import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { usePurchaseOrders } from '../inventory/usePurchaseOrders';
import { useDepartmentScope } from '../useDepartmentScope';

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
  // Only receipts against this plant's POs (usePurchaseOrders is plant-scoped).
  const { plantId } = useDepartmentScope();
  const { orders: plantOrders } = usePurchaseOrders();
  const poIdsKey = plantId ? plantOrders.map((o) => o.id).sort().join(',') : '';

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
          if (plantId && !poIdsKey.split(',').includes(String(data.poId))) return;
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
  }, [companyId, windowDays, plantId, poIdsKey]);

  return { data, loading, error };
}
