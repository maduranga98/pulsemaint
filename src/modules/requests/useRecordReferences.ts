import { useEffect, useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';
import { useAuthStore } from '@/store/authStore';

export interface RecordReference {
  type: 'work_order' | 'breakdown';
  id: string;
  /** WO number / breakdown ticket number. */
  number: string;
  machineName: string;
  status: string;
  /** Created / reported, epoch ms. */
  at: number;
}

// One load per signed-in user per session — reopening the form reuses it.
const cache = new Map<string, Promise<RecordReference[]>>();

/**
 * Work orders and breakdowns of the signed-in user's own plant (and own
 * department, for department-scoped roles) they can pick when asking for
 * access to past records. Loaded through the `listRecordReferences` Cloud
 * Function, since most roles can't list work orders under firestore.rules.
 */
export function useRecordReferences(enabled: boolean): { records: RecordReference[]; loading: boolean; error: boolean } {
  const uid = useAuthStore((s) => s.userProfile?.id);
  const [records, setRecords] = useState<RecordReference[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!enabled || !uid) return;
    let cancelled = false;
    let p = cache.get(uid);
    if (!p) {
      p = httpsCallable<unknown, { records: RecordReference[] }>(functions, 'listRecordReferences')({}).then((r) => r.data.records);
      cache.set(uid, p);
      p.catch(() => cache.delete(uid));
    }
    setLoading(true);
    setError(false);
    p.then((rows) => {
      if (!cancelled) setRecords(rows);
    })
      .catch((err) => {
        console.error('listRecordReferences failed', err);
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, uid]);

  return { records, loading, error };
}
