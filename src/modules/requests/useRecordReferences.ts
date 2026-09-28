import { useEffect, useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { collection, getDocs, limit, orderBy, query, where, type QueryConstraint } from 'firebase/firestore';
import { db, functions } from '@/lib/firebase';
import { useAuthStore } from '@/store/authStore';
import { useRecordPlantMatcher } from '@/hooks/useRecordPlantMatcher';
import {
  bdFinishedAtMs,
  FINISHED_WO_STATUSES,
  isPickableBreakdown,
  isPickableWorkOrder,
  woFinishedAtMs,
} from '@/lib/recordReferences';

export interface RecordReference {
  type: 'work_order' | 'breakdown';
  id: string;
  /** WO number / breakdown ticket number. */
  number: string;
  machineName: string;
  /** Finished (signed off / closed), epoch ms. */
  at: number;
}

type Matcher = ReturnType<typeof useRecordPlantMatcher>;
interface Profile {
  id: string;
  role: string;
  companyId: string;
  siteIds?: string[];
}

const MAX = 500;

/**
 * Direct Firestore read, used when the listRecordReferences function can't be
 * reached. Covers what the signed-in role may read under firestore.rules:
 * technicians / trainees only their assigned WOs, floor operators no WOs;
 * every role can read breakdowns.
 */
async function loadDirect(profile: Profile, inScope: Matcher): Promise<RecordReference[]> {
  const siteId = profile.siteIds?.[0] || profile.companyId;
  const out: RecordReference[] = [];
  const now = Date.now();

  if (profile.role !== 'floor_operator') {
    const constraints: QueryConstraint[] = [
      where('siteId', '==', siteId),
      where('status', 'in', [...FINISHED_WO_STATUSES]),
      orderBy('createdAt', 'desc'),
      limit(MAX),
    ];
    if (profile.role === 'technician' || profile.role === 'trainee') {
      constraints.unshift(where('assignedTechnicianIds', 'array-contains', profile.id));
    }
    try {
      const snap = await getDocs(query(collection(db, 'workOrders'), ...constraints));
      snap.docs.forEach((d) => {
        const w = d.data();
        if (!w.woNumber || !isPickableWorkOrder(w, now) || !inScope(w)) return;
        out.push({ type: 'work_order', id: d.id, number: w.woNumber, machineName: w.machineName ?? '', at: woFinishedAtMs(w) });
      });
    } catch (err) {
      console.error('Direct work order lookup failed', err);
    }
  }

  try {
    const snap = await getDocs(
      query(collection(db, 'breakdown_tickets'), where('siteId', '==', siteId), where('status', '==', 'closed'), limit(MAX)),
    );
    snap.docs.forEach((d) => {
      const b = d.data();
      if (!b.ticketNumber || !isPickableBreakdown(b, now) || !inScope(b)) return;
      out.push({ type: 'breakdown', id: d.id, number: b.ticketNumber, machineName: b.machineName ?? '', at: bdFinishedAtMs(b) });
    });
  } catch (err) {
    console.error('Direct breakdown lookup failed', err);
  }

  return out.sort((a, b) => b.at - a.at);
}

// One load per signed-in user per session — reopening the form reuses it.
const cache = new Map<string, Promise<RecordReference[]>>();

/**
 * Finished work orders and breakdowns (signed off / closed 30+ days ago) of
 * the signed-in user's own plant — and own department, for department-scoped
 * roles — they can pick when asking for access to past records. Loaded
 * through the `listRecordReferences` Cloud Function (most roles can't list
 * work orders under firestore.rules), falling back to a direct read of what
 * the role can see if the function isn't reachable.
 */
export function useRecordReferences(enabled: boolean): { records: RecordReference[]; loading: boolean; error: boolean } {
  const profile = useAuthStore((s) => s.userProfile);
  const inScope = useRecordPlantMatcher();
  const [records, setRecords] = useState<RecordReference[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const uid = profile?.id;

  useEffect(() => {
    if (!enabled || !uid || !profile?.companyId) return;
    let cancelled = false;
    let p = cache.get(uid);
    if (!p) {
      const me: Profile = { id: uid, role: profile.role, companyId: profile.companyId, siteIds: profile.siteIds };
      p = httpsCallable<unknown, { records: RecordReference[] }>(functions, 'listRecordReferences')({})
        .then((r) => r.data.records)
        .catch((err) => {
          console.error('listRecordReferences failed; reading directly instead', err);
          return loadDirect(me, inScope);
        });
      cache.set(uid, p);
      p.catch(() => cache.delete(uid));
    }
    setLoading(true);
    setError(false);
    p.then((rows) => {
      if (!cancelled) setRecords(rows);
    })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // inScope changes as the machine map loads; the cached result is kept.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, uid, profile?.companyId]);

  return { records, loading, error };
}
