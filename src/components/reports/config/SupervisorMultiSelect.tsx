import { useEffect, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { useAuthStore } from '../../../store/authStore';
import SearchableMultiSelect, { type SelectOption } from './SearchableMultiSelect';

/**
 * Supervisor filter backed by registered users with the supervisor role
 * (companies/{companyId}/users), instead of free-typed names.
 */
export default function SupervisorMultiSelect({ values, onChange }: { values: string[]; onChange: (values: string[]) => void }) {
  const companyId = useAuthStore((s) => s.userProfile?.companyId ?? '');
  const [options, setOptions] = useState<SelectOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!companyId) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const snap = await getDocs(
          query(collection(db, `companies/${companyId}/users`), where('role', '==', 'supervisor')),
        );
        const opts = snap.docs.map((d) => {
          const data = d.data();
          return {
            value: d.id,
            label: String(data.fullName ?? d.id),
            hint: String(data.department ?? ''),
          };
        });
        if (!cancelled) setOptions(opts.sort((a, b) => a.label.localeCompare(b.label)));
      } catch {
        /* leave options empty on permission/network errors */
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  return (
    <SearchableMultiSelect
      label="Supervisor"
      options={options}
      values={values}
      onChange={onChange}
      placeholder="Search supervisors…"
      loading={loading}
    />
  );
}
