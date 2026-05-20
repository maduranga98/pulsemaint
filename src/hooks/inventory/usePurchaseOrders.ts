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

    const constraints: Parameters<typeof query>[1][] = [
      where('companyId', '==', companyId),
    ];

    if (status) {
      constraints.push(where('status', '==', status));
    }

    constraints.push(orderBy('raisedAt', 'desc'));

    const q = query(collection(db, 'purchaseOrders'), ...constraints);

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const docs = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as PurchaseOrder[];
        setOrders(docs);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [companyId, status]);

  return { orders, loading, error };
}
