import { useState, useEffect } from 'react';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuthStore } from '@/store/authStore';
import type { Supplier } from '@/types/inventory';

export function useSuppliers() {
  const companyId = useAuthStore((s) => s.userProfile?.companyId);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId) {
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'suppliers'),
      where('companyId', '==', companyId),
      orderBy('name', 'asc'),
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setSuppliers(snapshot.docs.map((d) => ({ ...d.data(), id: d.id } as Supplier)));
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [companyId]);

  return { suppliers, loading, error };
}
