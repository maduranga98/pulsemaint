import { useState, useCallback } from 'react';
import { doc, runTransaction, updateDoc, arrayUnion, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuthStore } from '../store/authStore';
import { toast } from 'sonner';
import { notifyRoles } from '../services/notifications.service';
import { syncPmScheduleWoStatus } from '../utils/pmScheduleSync';
import type { AssigneeCompletion, PartUsed, TechnicianWorkLog, WorkOrder } from '../types/workOrder';

interface UseMyWorkCompletionResult {
  submitMyWork: (
    woId: string,
    entry: Omit<AssigneeCompletion, 'completedAt'>,
  ) => Promise<boolean>;
  loading: boolean;
}

const WORKING_STATUSES = ['IN_PROGRESS', 'ON_HOLD_PARTS', 'ON_HOLD_APPROVAL'];

/**
 * Records the signed-in assignee's own completion of their part of a work
 * order (`assigneeCompletions`), which drops the WO from that person's job
 * queue. When the last assigned person records theirs, the WO itself moves to
 * COMPLETED automatically — everyone's work is compiled into the WO's work
 * logs, parts actually issued are carried into `partsUsed`, the linked
 * breakdown tickets are resolved, and the supervisor/manager is notified to
 * sign it off. Done in a transaction so two people finishing at the same
 * moment can't both miss (or both trigger) the final completion.
 */
export function useMyWorkCompletion(): UseMyWorkCompletionResult {
  const [loading, setLoading] = useState(false);
  const user = useAuthStore((s) => s.user);

  const submitMyWork = useCallback(
    async (woId: string, entry: Omit<AssigneeCompletion, 'completedAt'>): Promise<boolean> => {
      if (!user) return false;
      setLoading(true);
      const actorName = useAuthStore.getState().userProfile?.fullName || user.displayName || '';
      try {
        const ref = doc(db, 'workOrders', woId);
        const finalised = await runTransaction(db, async (tx) => {
          const snap = await tx.get(ref);
          const wo = snap.data() as WorkOrder | undefined;
          const now = Timestamp.now();
          const existing = wo?.assigneeCompletions ?? [];
          // Replace this person's prior completion if they resubmit, otherwise add.
          const next: AssigneeCompletion[] = [
            ...existing.filter((c) => c.technicianId !== entry.technicianId),
            { ...entry, completedAt: now },
          ];
          const myEntry = {
            status: wo?.status ?? 'IN_PROGRESS',
            changedBy: user.uid,
            changedByName: actorName,
            changedAt: now,
            note: `${entry.technicianName} marked their own work complete`,
          };

          const assigned = wo?.assignedTechnicianIds ?? [];
          const doneIds = new Set(next.map((c) => c.technicianId));
          const everyoneDone = assigned.length > 0 && assigned.every((id) => doneIds.has(id));
          if (!wo || !everyoneDone || !WORKING_STATUSES.includes(wo.status)) {
            tx.update(ref, { assigneeCompletions: next, statusHistory: arrayUnion(myEntry), updatedAt: serverTimestamp() });
            return null;
          }

          // Everyone is done — finalise the WO as COMPLETED, awaiting sign-off.
          const starts = (wo.assigneeStates ?? [])
            .map((st) => st.startedAt?.toMillis?.())
            .filter((v): v is number => typeof v === 'number');
          const startMs = wo.actualStartTime?.toMillis?.() ?? (starts.length ? Math.min(...starts) : now.toMillis());
          const workLogs: TechnicianWorkLog[] = next.map((c) => ({
            technicianId: c.technicianId,
            technicianName: c.technicianName,
            technicianRole: c.technicianRole,
            hoursWorked: c.hoursWorked,
            tasksDescription: [c.workDoneDescription, c.completedStepsDescription].filter(Boolean).join('\n'),
          }));
          const partsUsed: PartUsed[] = [...(wo.partsUsed ?? [])];
          const haveIds = new Set(partsUsed.map((p) => p.partId).filter(Boolean));
          for (const r of wo.partsRequests ?? []) {
            if (r.status !== 'issued' || !r.partId || haveIds.has(r.partId)) continue;
            partsUsed.push({
              partId: r.partId, partName: r.partName, quantity: r.quantity, unit: r.unit,
              source: 'stock', unitCost: 0, totalCost: 0, warrantyMonths: null,
            });
          }
          tx.update(ref, {
            assigneeCompletions: next,
            status: 'COMPLETED',
            statusHistory: arrayUnion(myEntry, {
              status: 'COMPLETED',
              changedBy: user.uid,
              changedByName: actorName,
              changedAt: now,
              note: 'Every assigned person completed their work — awaiting sign-off',
            }),
            actualStartTime: Timestamp.fromMillis(startMs),
            actualEndTime: now,
            totalDurationMinutes: Math.max(0, Math.round((now.toMillis() - startMs) / 60000)),
            technicianWorkLogs: workLogs,
            workDoneDescription: next
              .map((c) => `${c.technicianName}: ${c.workDoneDescription || c.completedStepsDescription || '—'}`)
              .join('\n'),
            partsUsed,
            updatedAt: serverTimestamp(),
          });
          return wo;
        });

        if (finalised) {
          // Resolve every breakdown ticket the WO covers (best-effort).
          const ticketIds = Array.from(
            new Set([finalised.linkedBreakdownId, ...(finalised.linkedBreakdownIds ?? [])].filter(Boolean) as string[]),
          );
          await Promise.all(ticketIds.map((ticketId) =>
            updateDoc(doc(db, 'breakdown_tickets', ticketId), {
              status: 'resolved',
              resolvedAt: serverTimestamp(),
              statusHistory: arrayUnion({
                status: 'resolved',
                changedBy: user.uid,
                changedByName: actorName,
                changedAt: Timestamp.now(),
                note: `WO ${finalised.woNumber ?? woId} completed by the whole team`,
              }),
            }).catch((e) => console.error('Failed to resolve linked breakdown on completion', e)),
          ));
          await syncPmScheduleWoStatus(woId, 'COMPLETED').catch(() => {});
          const profile = useAuthStore.getState().userProfile;
          if (profile?.companyId) {
            void notifyRoles(profile.companyId, ['supervisor', 'plant_manager'], {
              type: 'work_order',
              message: `Work order ${finalised.woNumber ?? woId} is completed and awaiting sign-off`,
              oversightMessage: `completed work order ${finalised.woNumber ?? woId} (awaiting sign-off)`,
              actorName,
              actorRole: profile.role,
              actorUserId: profile.id,
              linkTo: `/app/work-orders?woId=${woId}`,
              plantId: finalised.machinePlantId ?? undefined,
              department: finalised.machineDepartment ?? null,
            });
          }
          toast.success('All work is complete — the work order is now awaiting sign-off.');
        } else {
          toast.success('Your work has been marked complete.');
        }
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

/**
 * Still in progress, but every assigned technician has already recorded their
 * own completion — the work is done and only needs finalising (the Complete
 * form) and then a sign-off. Listed alongside COMPLETED work orders so it
 * never sits unnoticed on the Need Sign-Off dashboard widget.
 */
export function isReadyToFinalise(
  wo: Pick<WorkOrder, 'status' | 'assignedTechnicianIds' | 'assigneeCompletions'>,
): boolean {
  return (
    ['IN_PROGRESS', 'ON_HOLD_PARTS', 'ON_HOLD_APPROVAL'].includes(wo.status) &&
    (wo.assignedTechnicianIds ?? []).length > 0 &&
    allAssigneesCompleted(wo)
  );
}

/** Whether every assigned technician has recorded their own completion. */
export function allAssigneesCompleted(wo: Pick<WorkOrder, 'assignedTechnicianIds' | 'assigneeCompletions'>): boolean {
  const ids = wo.assignedTechnicianIds ?? [];
  if (ids.length === 0) return true;
  const done = new Set((wo.assigneeCompletions ?? []).map((c) => c.technicianId));
  return ids.every((id) => done.has(id));
}
