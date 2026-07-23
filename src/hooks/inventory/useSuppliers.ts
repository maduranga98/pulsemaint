import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
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

    // Sorted client-side (below) to avoid a companyId+name composite index — a
    // missing index would make the listener error and leave the supplier list
    // (and the PO "Select Supplier" dropdown) permanently empty.
    const q = query(
      collection(db, 'suppliers'),
      where('companyId', '==', companyId),
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const rows = snapshot.docs.map((d) => ({ ...d.data(), id: d.id } as Supplier));
        rows.sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));
        setSuppliers(rows);
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
