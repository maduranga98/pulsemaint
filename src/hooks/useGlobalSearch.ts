import { useState, useEffect, useRef, useCallback } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuthStore } from '../store/authStore';

export type SearchGroupKey = 'machines' | 'workOrders' | 'breakdowns' | 'parts' | 'contractors';

export interface SearchResult {
  id: string;
  group: SearchGroupKey;
  title: string;
  subtitle: string;
  to: string;
}

export interface SearchGroup {
  key: SearchGroupKey;
  label: string;
  results: SearchResult[];
}

const PER_GROUP_LIMIT = 5;
const DEBOUNCE_MS = 250;
const HIGH_UNICODE = '\uf8ff';

/** Firestore prefix range query on a lowercased name field. */
function prefixRange(field: string, q: string) {
  return [where(field, '>=', q), where(field, '<=', q + HIGH_UNICODE), orderBy(field), limit(PER_GROUP_LIMIT)];
}

export function useGlobalSearch(rawQuery: string) {
  const userProfile = useAuthStore((s) => s.userProfile);
  const companyId = userProfile?.companyId;
  const siteId = userProfile ? userProfile.siteIds[0] || userProfile.companyId : '';

  const [groups, setGroups] = useState<SearchGroup[]>([]);
  const [loading, setLoading] = useState(false);

  // Cache the (small) contractors list once per open session for client-side filtering.
  const contractorsCache = useRef<{ id: string; name: string; sub: string }[] | null>(null);

  const loadContractors = useCallback(async () => {
    if (contractorsCache.current || !companyId) return;
    try {
      const snap = await getDocs(
        query(collection(db, 'contractors'), where('companyId', '==', companyId), limit(200)),
      );
      contractorsCache.current = snap.docs.map((d) => {
        const data = d.data() as any;
        return {
          id: d.id,
          name: data.companyName ?? data.tradeName ?? 'Contractor',
          sub: data.city ?? data.companyType ?? '',
        };
      });
    } catch {
      contractorsCache.current = [];
    }
  }, [companyId]);

  useEffect(() => {
    const q = rawQuery.trim().toLowerCase();
    if (q.length < 2 || !companyId) {
      setGroups([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    const handle = setTimeout(async () => {
      await loadContractors();

      const safe = async <T,>(p: Promise<T>, fallback: T): Promise<T> => {
        try {
          return await p;
        } catch {
          return fallback;
        }
      };

      const [machineSnap, woSnap, bdSnap, partSnap] = await Promise.all([
        safe(getDocs(query(collection(db, 'machines'), where('siteId', '==', siteId), ...prefixRange('nameLower', q))), null),
        safe(getDocs(query(collection(db, 'workOrders'), where('companyId', '==', companyId), ...prefixRange('nameLower', q))), null),
        safe(getDocs(query(collection(db, 'breakdown_tickets'), where('companyId', '==', companyId), ...prefixRange('nameLower', q))), null),
        safe(getDocs(query(collection(db, 'inventoryParts'), where('companyId', '==', companyId), ...prefixRange('nameLower', q))), null),
      ]);

      if (cancelled) return;

      const next: SearchGroup[] = [];

      const machines: SearchResult[] =
        machineSnap?.docs.map((d) => {
          const m = d.data() as any;
          return {
            id: d.id,
            group: 'machines' as const,
            title: m.name ?? 'Machine',
            subtitle: [m.department, m.serialNumber].filter(Boolean).join(' · '),
            to: `/app/machines/${d.id}`,
          };
        }) ?? [];
      if (machines.length) next.push({ key: 'machines', label: 'Machines', results: machines });

      const wos: SearchResult[] =
        woSnap?.docs.map((d) => {
          const w = d.data() as any;
          return {
            id: d.id,
            group: 'workOrders' as const,
            title: w.woNumber || w.machineName || 'Work Order',
            subtitle: [w.machineName, w.status].filter(Boolean).join(' · '),
            to: `/app/work-orders?woId=${d.id}`,
          };
        }) ?? [];
      if (wos.length) next.push({ key: 'workOrders', label: 'Work Orders', results: wos });

      const bds: SearchResult[] =
        bdSnap?.docs.map((d) => {
          const b = d.data() as any;
          return {
            id: d.id,
            group: 'breakdowns' as const,
            title: b.ticketNumber || 'Breakdown',
            subtitle: [b.machineName, b.severity].filter(Boolean).join(' · '),
            to: `/app/breakdowns/${d.id}`,
          };
        }) ?? [];
      if (bds.length) next.push({ key: 'breakdowns', label: 'Breakdowns', results: bds });

      const parts: SearchResult[] =
        partSnap?.docs.map((d) => {
          const p = d.data() as any;
          return {
            id: d.id,
            group: 'parts' as const,
            title: p.name ?? 'Part',
            subtitle: [p.partNumber, p.category].filter(Boolean).join(' · '),
            to: `/app/inventory/catalog/${d.id}`,
          };
        }) ?? [];
      if (parts.length) next.push({ key: 'parts', label: 'Parts', results: parts });

      // Contractors: small collection — filter the cached list client-side.
      const contractors: SearchResult[] = (contractorsCache.current ?? [])
        .filter((c) => c.name.toLowerCase().includes(q))
        .slice(0, PER_GROUP_LIMIT)
        .map((c) => ({
          id: c.id,
          group: 'contractors' as const,
          title: c.name,
          subtitle: c.sub,
          to: `/app/contractors/${c.id}`,
        }));
      if (contractors.length) next.push({ key: 'contractors', label: 'Contractors', results: contractors });

      setGroups(next);
      setLoading(false);
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [rawQuery, companyId, siteId, loadContractors]);

  return { groups, loading };
}
