import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuthStore } from '@/store/authStore';
import type { AssignmentStatus } from '@/lib/training/trainingTypes';

export interface ModuleAssignmentCount {
  /** People currently holding an assignment for this module. */
  assigned: number;
  /** Of those, how many have finished (certified). */
  completed: number;
}

interface UseModuleAssignmentCountsResult {
  counts: Record<string, ModuleAssignmentCount>;
  loading: boolean;
}

/**
 * Live per-module assignment tallies, keyed by moduleId.
 *
 * The module library's "Assigned" column used to read the denormalized
 * `trainingModules.usageCount` field, which nothing in the app ever
 * incremented — so it sat at 0 (or blank on modules created through the
 * editor, which never wrote the field at all) no matter how many people the
 * module had been assigned to. Counting the live `trainingAssignments`
 * snapshot instead means the column updates the moment an assignment is
 * created, completed, or removed, with no denormalized counter to drift.
 */
export function useModuleAssignmentCounts(): UseModuleAssignmentCountsResult {
  const companyId = useAuthStore((s) => s.userProfile?.companyId);
  const [rows, setRows] = useState<{ moduleId: string; status: AssignmentStatus }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsub = onSnapshot(
      query(collection(db, 'trainingAssignments'), where('companyId', '==', companyId)),
      (snap) => {
        setRows(
          snap.docs.map((d) => {
            const data = d.data();
            return { moduleId: String(data.moduleId ?? ''), status: data.status as AssignmentStatus };
          })
        );
        setLoading(false);
      },
      // A denied read must leave the column at zero rather than blank the list.
      () => {
        setRows([]);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [companyId]);

  const counts = useMemo(() => {
    const acc: Record<string, ModuleAssignmentCount> = {};
    for (const row of rows) {
      if (!row.moduleId) continue;
      const entry = acc[row.moduleId] ?? { assigned: 0, completed: 0 };
      entry.assigned += 1;
      if (row.status === 'certified') entry.completed += 1;
      acc[row.moduleId] = entry;
    }
    return acc;
  }, [rows]);

  return { counts, loading };
}
