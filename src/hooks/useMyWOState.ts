import { useCallback, useState } from 'react';
import { doc, getDoc, updateDoc, writeBatch, arrayUnion, serverTimestamp, Timestamp } from 'firebase/firestore';
import { toast } from 'sonner';
import { db } from '../lib/firebase';
import { useAuthStore } from '../store/authStore';
import { aggregateWoStatus } from '../lib/workorders/assigneeState';
import type { AssigneeWorkState, AssigneeWorkStatus, WorkOrder } from '../types/workOrder';

interface SetMyStateOptions {
  technicianName: string;
  holdReason?: string;
}

interface UseMyWOStateResult {
  setMyState: (woId: string, status: AssigneeWorkStatus, opts: SetMyStateOptions) => Promise<boolean>;
  loading: boolean;
}

/**
 * Updates the signed-in assignee's own start/hold/resume state on a shared work
 * order. Each assignee operates their own work independently — one starting
 * doesn't start the job for the others, and one holding for parts doesn't pause
 * a teammate. The shared `status` is re-derived from everyone's state so the
 * supervisor still sees the ticket move (IN_PROGRESS as soon as anyone works;
 * on-hold only when every active assignee is on hold).
 */
export function useMyWOState(): UseMyWOStateResult {
  const [loading, setLoading] = useState(false);
  const user = useAuthStore((s) => s.user);

  const setMyState = useCallback(
    async (woId: string, status: AssigneeWorkStatus, opts: SetMyStateOptions): Promise<boolean> => {
      const myId = user?.uid;
      if (!myId) return false;
      setLoading(true);
      try {
        const ref = doc(db, 'workOrders', woId);
        const snap = await getDoc(ref);
        const wo = snap.data() as WorkOrder | undefined;
        const existing = wo?.assigneeStates ?? [];
        const prior = existing.find((s) => s.technicianId === myId);
        const now = Timestamp.now();

        const mine: AssigneeWorkState = {
          technicianId: myId,
          technicianName: opts.technicianName,
          status,
          // Preserve the first start time; set it the first time they start.
          startedAt: prior?.startedAt ?? (status === 'IN_PROGRESS' ? now : null),
          holdReason: status === 'IN_PROGRESS' ? '' : opts.holdReason ?? '',
          updatedAt: now,
        };
        const nextStates: AssigneeWorkState[] = [
          ...existing.filter((s) => s.technicianId !== myId),
          mine,
        ];

        const completedIds = new Set((wo?.assigneeCompletions ?? []).map((c) => c.technicianId));
        const nextStatus = aggregateWoStatus(nextStates, completedIds, wo?.status ?? 'IN_PROGRESS');

        const startingWO = !wo?.actualStartTime && status === 'IN_PROGRESS';
        const label =
          status === 'IN_PROGRESS'
            ? `${opts.technicianName} started their work`
            : `${opts.technicianName} put their work on hold (${status === 'ON_HOLD_PARTS' ? 'parts' : 'approval'})`;

        await updateDoc(ref, {
          assigneeStates: nextStates,
          status: nextStatus,
          ...(startingWO ? { actualStartTime: now } : {}),
          statusHistory: arrayUnion({
            status: nextStatus,
            changedBy: myId,
            changedByName: opts.technicianName,
            changedAt: now,
            note: label,
          }),
          updatedAt: serverTimestamp(),
        });

        // The first time anyone actually starts this WO, advance every
        // breakdown ticket it covers from "assigned" to "in progress" — a
        // ticket shouldn't show repair progress before work has begun.
        if (startingWO) {
          const ticketIds = Array.from(
            new Set([...(wo?.linkedBreakdownId ? [wo.linkedBreakdownId] : []), ...(wo?.linkedBreakdownIds ?? [])]),
          );
          if (ticketIds.length > 0) {
            try {
              const bdBatch = writeBatch(db);
              for (const ticketId of ticketIds) {
                bdBatch.update(doc(db, 'breakdown_tickets', ticketId), {
                  status: 'repair_in_progress',
                  repairStartedAt: now,
                  statusHistory: arrayUnion({
                    status: 'repair_in_progress',
                    changedBy: myId,
                    changedByName: opts.technicianName,
                    changedAt: now,
                    note: `${opts.technicianName} started work on the linked work order`,
                  }),
                });
              }
              await bdBatch.commit();
            } catch (bdErr) {
              console.error('Failed to advance linked breakdown(s) to in-progress', bdErr);
            }
          }
        }
        return true;
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to update your work state');
        return false;
      } finally {
        setLoading(false);
      }
    },
    [user],
  );

  return { setMyState, loading };
}
