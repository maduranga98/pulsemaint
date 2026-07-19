import { useState, useEffect } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuthStore } from '@/store/authStore';
import type { PurchaseOrder, PurchaseOrderStatus } from '@/types/inventory';

interface UsePurchaseOrdersResult {
  orders: PurchaseOrder[];
  loading: boolean;
  error: string | null;
}

export function usePurchaseOrders(status?: PurchaseOrderStatus): UsePurchaseOrdersResult {
  const companyId = useAuthStore((s) => s.userProfile?.companyId);

  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const baseConstraints: Parameters<typeof query>[1][] = [
      where('companyId', '==', companyId),
    ];

    if (status) {
      baseConstraints.push(where('status', '==', status));
    }

    const sortByRaisedAt = (docs: PurchaseOrder[]) =>
      [...docs].sort((a, b) => {
        const aSec = (a.raisedAt as { seconds?: number } | null)?.seconds ?? 0;
        const bSec = (b.raisedAt as { seconds?: number } | null)?.seconds ?? 0;
        return bSec - aSec;
      });

    const toOrders = (snapshot: { docs: { id: string; data: () => unknown }[] }) =>
      snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as object) })) as PurchaseOrder[];

    let fallbackUnsub: (() => void) | null = null;

    const orderedQuery = query(
      collection(db, 'purchaseOrders'),
      ...baseConstraints,
      orderBy('raisedAt', 'desc'),
    );

    const unsubscribe = onSnapshot(
      orderedQuery,
      (snapshot) => {
        setOrders(toOrders(snapshot));
        setLoading(false);
      },
      (err) => {
        // The ordered query needs a composite index. If it is missing (or the
        // ordered read is denied) fall back to the plain companyId query and
        // sort client-side so the PO list never dies with an error box.
        console.error('Ordered purchaseOrders query failed; falling back', err);
        const fallbackQuery = query(collection(db, 'purchaseOrders'), ...baseConstraints);
        fallbackUnsub = onSnapshot(
          fallbackQuery,
          (snapshot) => {
            setOrders(sortByRaisedAt(toOrders(snapshot)));
            setError(null);
            setLoading(false);
          },
          (fallbackErr) => {
            setError(fallbackErr.message);
            setLoading(false);
          }
        );
      }
    );

    return () => {
      unsubscribe();
      fallbackUnsub?.();
    };
  }, [companyId, status]);

  return { orders, loading, error };
}
