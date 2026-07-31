import { useState, useCallback } from 'react';
import { doc, getDoc, updateDoc, arrayUnion, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuthStore } from '../store/authStore';
import { toast } from 'sonner';
import type { AssigneeCompletion, WorkOrder } from '../types/workOrder';

interface UseMyWorkCompletionResult {
  submitMyWork: (
    woId: string,
    entry: Omit<AssigneeCompletion, 'completedAt'>,
  ) => Promise<boolean>;
  loading: boolean;
}

/**
 * Records the signed-in assignee's own completion of their part of a work
 * order (`assigneeCompletions`). This never changes the WO status — the WO is
 * only finalised (→ COMPLETED / sign-off) once every assignee has recorded
 * their own completion, which is gated in the finalisation flow.
 */
export function useMyWorkCompletion(): UseMyWorkCompletionResult {
  const [loading, setLoading] = useState(false);
  const user = useAuthStore((s) => s.user);

  const submitMyWork = useCallback(
    async (woId: string, entry: Omit<AssigneeCompletion, 'completedAt'>): Promise<boolean> => {
      if (!user) return false;
      setLoading(true);
      try {
        const ref = doc(db, 'workOrders', woId);
        const snap = await getDoc(ref);
        const wo = snap.data() as WorkOrder | undefined;
        const existing = wo?.assigneeCompletions ?? [];
        // Replace this person's prior completion if they resubmit, otherwise add.
        const next: AssigneeCompletion[] = [
          ...existing.filter((c) => c.technicianId !== entry.technicianId),
          { ...entry, completedAt: Timestamp.now() },
        ];
        await updateDoc(ref, {
          assigneeCompletions: next,
          statusHistory: arrayUnion({
            status: wo?.status ?? 'IN_PROGRESS',
            changedBy: user.uid,
            changedByName: user.displayName ?? '',
            changedAt: Timestamp.now(),
            note: `${entry.technicianName} marked their own work complete`,
          }),
          updatedAt: serverTimestamp(),
        });
        toast.success('Your work has been marked complete.');
        return true;
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to submit your work');
        return false;
      } finally {
        setLoading(false);
      }
    },
    [user],
  );

  return { submitMyWork, loading };
}

/** Whether every assigned technician has recorded their own completion. */
export function allAssigneesCompleted(wo: Pick<WorkOrder, 'assignedTechnicianIds' | 'assigneeCompletions'>): boolean {
  const ids = wo.assignedTechnicianIds ?? [];
  if (ids.length === 0) return true;
  const done = new Set((wo.assigneeCompletions ?? []).map((c) => c.technicianId));
  return ids.every((id) => done.has(id));
}
