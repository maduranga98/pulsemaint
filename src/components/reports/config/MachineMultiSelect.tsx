import { useEffect, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { useAuthStore } from '../../../store/authStore';
import SearchableMultiSelect, { type SelectOption } from './SearchableMultiSelect';

/**
 * Machine filter backed by the real machines registry so selected values are
 * machine IDs that match what breakdown/WO documents store. Machines are
 * scoped by siteId (which falls back to companyId for single-site tenants).
 */
export default function MachineMultiSelect({ values, onChange }: { values: string[]; onChange: (values: string[]) => void }) {
  const userProfile = useAuthStore((s) => s.userProfile);
  const [options, setOptions] = useState<SelectOption[]>([]);
  const [loading, setLoading] = useState(true);

  const siteKey = [...(userProfile?.siteIds ?? []), userProfile?.companyId ?? ''].filter(Boolean).join(',');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const siteIds = [...new Set(siteKey.split(',').filter(Boolean))];
      if (siteIds.length === 0) {
        setLoading(false);
        return;
      }
      const opts: SelectOption[] = [];
      for (let i = 0; i < siteIds.length; i += 10) {
        const chunk = siteIds.slice(i, i + 10);
        try {
          const snap = await getDocs(query(collection(db, 'machines'), where('siteId', 'in', chunk)));
          snap.docs.forEach((d) => {
            const data = d.data();
            opts.push({
              value: d.id,
              label: String(data.name ?? d.id),
              hint: String(data.department ?? ''),
            });
          });
        } catch {
          /* ignore unreadable sites */
        }
      }
      if (!cancelled) {
        setOptions(opts.sort((a, b) => a.label.localeCompare(b.label)));
        setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [siteKey]);

  return (
    <SearchableMultiSelect
      label="Machine"
      options={options}
      values={values}
      onChange={onChange}
      placeholder="Search machines…"
      loading={loading}
    />
  );
}
