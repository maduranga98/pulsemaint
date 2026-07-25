import { useState, useEffect } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuthStore } from '@/store/authStore';

export interface MachineOption {
  id: string;
  name: string;
  department: string;
}

// Machines from the real Machine Registry, scoped the same way as the
// reports MachineMultiSelect: by the user's siteIds, falling back to
// companyId for single-site tenants where siteId == companyId.
export function useMachineOptions() {
  const userProfile = useAuthStore((s) => s.userProfile);
  const [machines, setMachines] = useState<MachineOption[]>([]);
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
      const opts: MachineOption[] = [];
      for (let i = 0; i < siteIds.length; i += 10) {
        const chunk = siteIds.slice(i, i + 10);
        try {
          const snap = await getDocs(query(collection(db, 'machines'), where('siteId', 'in', chunk)));
          snap.docs.forEach((d) => {
            const data = d.data();
            opts.push({
              id: d.id,
              name: String(data.name ?? d.id),
              department: String(data.department ?? ''),
            });
          });
        } catch {
          /* ignore unreadable sites */
        }
      }
      if (!cancelled) {
        setMachines(opts.sort((a, b) => a.name.localeCompare(b.name)));
        setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [siteKey]);

  return { machines, loading };
}
