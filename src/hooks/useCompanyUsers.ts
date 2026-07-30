import { useEffect, useState } from 'react';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export interface CompanyUserOption {
  id: string;
  fullName: string;
  role: string;
  department: string | null;
  shiftId: string | null;
}

/**
 * The company's people, live, for pickers that assign work or shifts to named
 * employees. Ordered by name so the list reads the same everywhere.
 */
export function useCompanyUsers(companyId: string | undefined) {
  const [users, setUsers] = useState<CompanyUserOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId) {
      setUsers([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsub = onSnapshot(
      query(collection(db, `companies/${companyId}/users`), orderBy('fullName', 'asc')),
      (snap) => {
        setUsers(
          snap.docs.map((d) => {
            const data = d.data();
            return {
              id: d.id,
              fullName: (data.fullName as string) ?? '',
              role: (data.role as string) ?? '',
              department: (data.department as string) ?? null,
              shiftId: (data.shiftId as string) ?? null,
            };
          }),
        );
        setError(null);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );
    return unsub;
  }, [companyId]);

  return { users, loading, error };
}
