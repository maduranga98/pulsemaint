import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';

export interface SupplierPoCount {
  supplierName: string;
  count: number;
}

const TOP_N = 8;

export function useSupplierPoCounts(companyId: string, windowDays: number = 30) {
  const [suppliers, setSuppliers] = useState<SupplierPoCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId) {
      setLoading(false);
      return;
    }

    const since = Timestamp.fromMillis(Date.now() - windowDays * 24 * 60 * 60 * 1000);
    const q = query(collection(db, 'purchaseOrders'), where('companyId', '==', companyId));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const counts = new Map<string, number>();
        snapshot.docs.forEach((d) => {
          const data = d.data();
          const raisedAt = data.raisedAt as Timestamp | undefined;
          if (!raisedAt || raisedAt.toMillis() < since.toMillis()) return;
          const supplierName = (data.supplierName as string) || 'Unknown supplier';
          counts.set(supplierName, (counts.get(supplierName) ?? 0) + 1);
        });

        const sorted = Array.from(counts.entries())
          .map(([supplierName, count]) => ({ supplierName, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, TOP_N);

        setSuppliers(sorted);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [companyId, windowDays]);

  return { suppliers, loading, error };
}
