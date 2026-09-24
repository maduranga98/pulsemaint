import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useDepartmentScope } from '@/hooks/useDepartmentScope';

export interface CompanyUserOption {
  id: string;
  fullName: string;
  role: string;
  department: string | null;
  shiftId: string | null;
  plantId: string | null;
}

/**
 * The company's people, live, for pickers that assign work or shifts to named
 * employees. Ordered by name so the list reads the same everywhere. Limited
 * to the caller's plant (plant-scoped roles; admin's selected plant tab) so
 * nobody can pick people from another plant. `includeAdmins` keeps the
 * company's admins in the list whatever their plant — admins oversee every
 * plant, so e.g. a safety case can always be reported to one.
 */
export function useCompanyUsers(companyId: string | undefined, opts: { includeAdmins?: boolean } = {}) {
  const [allUsers, setUsers] = useState<CompanyUserOption[]>([]);
  const { plantId } = useDepartmentScope();
  const includeAdmins = !!opts.includeAdmins;
  const users = useMemo(
    () => (plantId
      ? allUsers.filter((u) => u.plantId === plantId || (includeAdmins && u.role === 'admin'))
      : allUsers),
    [allUsers, plantId, includeAdmins],
  );
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
              plantId: (data.plantId as string) ?? null,
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
