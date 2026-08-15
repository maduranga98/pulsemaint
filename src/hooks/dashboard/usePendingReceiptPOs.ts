import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import type { PurchaseOrder } from '../../types/inventory';

// POs already sent to the supplier that haven't been fully received yet.
const SENT_NOT_RECEIVED_STATUSES = ['sent', 'invoice_received', 'acknowledged', 'partially_received'];

export function usePendingReceiptPOs(companyId: string) {
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId) {
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'purchaseOrders'),
      where('companyId', '==', companyId),
      where('status', 'in', SENT_NOT_RECEIVED_STATUSES),
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((d) => ({ ...d.data(), id: d.id } as PurchaseOrder));
        setOrders(data);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [companyId]);

  return { orders, count: orders.length, loading, error };
}
