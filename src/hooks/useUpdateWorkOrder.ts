import { useState, useCallback } from 'react';
import { doc, getDoc, updateDoc, arrayUnion, serverTimestamp, Timestamp, collection, query, where, getDocs, limit } from 'firebase/firestore';
import type { BreakdownStatus } from '../types/breakdown';
import { db } from '../lib/firebase';
import type { WorkOrder, WOStatus, TimeSegment, TimeSegmentState } from '../types/workOrder';
import type { Permit } from '../types/permit';
import { useAuthStore } from '../store/authStore';
import { toast } from 'sonner';
import { computeLotoGatePassed } from '../lib/lotoGate';
import { syncPmScheduleWoStatus } from '../utils/pmScheduleSync';

interface UseUpdateWorkOrderResult {
  updateWO: (id: string, data: Partial<WorkOrder>) => Promise<boolean>;
  updateStatus: (id: string, status: WOStatus, note?: string) => Promise<boolean>;
  loading: boolean;
  error: string | null;
}

// Statuses that represent hands-on/hold time for Wrench Time reporting. Other
// statuses (OPEN, ASSIGNED, COMPLETED, ...) don't map to a segment — the
// currently open segment (if any) is simply closed when moving to them.
const STATUS_TO_SEGMENT: Partial<Record<WOStatus, TimeSegmentState>> = {
  IN_PROGRESS: 'working',
  ON_HOLD_PARTS: 'waiting-parts',
  ON_HOLD_APPROVAL: 'waiting-permit',
};

export function useUpdateWorkOrder(): UseUpdateWorkOrderResult {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const user = useAuthStore((s) => s.user);

  const updateWO = useCallback(async (id: string, data: Partial<WorkOrder>): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      await updateDoc(doc(db, 'workOrders', id), {
        ...data,
        updatedAt: serverTimestamp(),
      });
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Update failed';
      setError(msg);
      toast.error(msg);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateStatus = useCallback(
    async (id: string, status: WOStatus, note?: string): Promise<boolean> => {
      if (!user) return false;
      setLoading(true);
      setError(null);

      // LOTO gate check: when transitioning OPEN/ASSIGNED → IN_PROGRESS
      if (status === 'IN_PROGRESS') {
        try {
          const woSnap = await getDoc(doc(db, 'workOrders', id));
          const woData = woSnap.data() as WorkOrder | undefined;

          if (woData && (woData.status === 'ASSIGNED' || woData.status === 'OPEN')) {
            // Fetch permit for this work order
            const permitQuery = query(
              collection(db, 'permits'),
              where('workOrderId', '==', id),
              limit(1),
            );
            const permitSnap = await getDocs(permitQuery);
            const permit = permitSnap.empty
              ? null
              : ({ id: permitSnap.docs[0].id, ...permitSnap.docs[0].data() } as Permit);

            const ptwCategory = woData.ptwCategory ?? null;

            // Machines without isolation points and WOs without a PTW category
            // have no safety gate to satisfy — don't block those from starting.
            let gateApplies = true;
            if (!permit && !ptwCategory) {
              const machineSnap = await getDoc(doc(db, 'machines', woData.machineId));
              const points = (machineSnap.data()?.isolationPoints ?? []) as unknown[];
              gateApplies = points.length > 0;
            }

            const gatePassed = !gateApplies || computeLotoGatePassed(permit, ptwCategory);

            if (!gatePassed) {
              const msg =
                permit === null
                  ? 'Safety gate not initialized. Please complete LOTO/PTW before starting work.'
                  : !permit.isolationChecklist.every((e) => e.locked)
                  ? 'Not all isolation points are locked. Complete LOTO procedure first.'
                  : !permit.zeroEnergyVerified
                  ? 'Zero energy state not verified. Complete verification before starting work.'
                  : ptwCategory
                  ? 'Permit to Work must be issued before starting work.'
                  : 'Safety gate check failed. Complete LOTO/PTW procedure first.';
              setError(msg);
              toast.error(msg);
              setLoading(false);
              return false;
            }
          }
        } catch (gateErr) {
          console.error('LOTO gate check error', gateErr);
          // Non-blocking: if check fails (e.g. permission error on an isolated network), allow transition
        }

        // Work Permit gate: a WO flagged `requiresWorkPermit` can't start until
        // its linked Permit-to-Work is active (issued and not yet closed/expired).
        try {
          const woSnap = await getDoc(doc(db, 'workOrders', id));
          const woData = woSnap.data() as (WorkOrder & { workPermitId?: string | null }) | undefined;
          if (woData?.requiresWorkPermit) {
            // Consider every permit linked to this WO (by workOrderId), plus the
            // permit the WO itself points at (workPermitId). A single `limit(1)`
            // query with no ordering could return a closed permit — or miss the
            // active one — and wrongly block a job whose permit is issued.
            const wpSnap = await getDocs(
              query(collection(db, 'work_permits'), where('workOrderId', '==', id)),
            );
            const statuses = wpSnap.docs.map((d) => (d.data() as { status?: string }).status);
            if (woData.workPermitId) {
              try {
                const linked = await getDoc(doc(db, 'work_permits', woData.workPermitId));
                if (linked.exists()) statuses.push((linked.data() as { status?: string }).status);
              } catch {
                // best-effort — the workOrderId query above is the primary check
              }
            }
            const hasActive = statuses.some((s) => s === 'active');
            const hasAny = statuses.length > 0;
            if (!hasActive) {
              const msg = !hasAny
                ? 'A Work Permit must be created before this job can start.'
                : 'The Work Permit for this job is not active. Issue or re-activate it before starting.';
              setError(msg);
              toast.error(msg);
              setLoading(false);
              return false;
            }
          }
        } catch (wpErr) {
          console.error('Work permit gate check error', wpErr);
          // Non-blocking on infra errors, consistent with the LOTO gate above.
        }
      }

      const historyEntry = {
        status,
        changedBy: user.uid,
        changedByName: user.displayName ?? '',
        // serverTimestamp() is not allowed inside arrayUnion() — Firestore
        // rejects the whole write, which blocked technicians from starting WOs.
        changedAt: Timestamp.now(),
        note: note ?? null,
      };

      const updates: Record<string, unknown> = {
        status,
        statusHistory: arrayUnion(historyEntry),
        updatedAt: serverTimestamp(),
      };

      // Stamp the real start time on the first transition to IN_PROGRESS so
      // duration can be computed as (completed − started), and track Wrench
      // Time segments: close whatever segment is currently open and, if the
      // new status is hands-on/hold work, open a fresh one for it.
      try {
        const snap = await getDoc(doc(db, 'workOrders', id));
        const woData = snap.data();

        if (status === 'IN_PROGRESS' && !woData?.actualStartTime) {
          updates.actualStartTime = Timestamp.now();
        }

        const now = Timestamp.now();
        const existingSegments: TimeSegment[] = Array.isArray(woData?.timeSegments)
          ? woData!.timeSegments
          : [];
        const closedSegments = existingSegments.map((seg) =>
          seg.endAt === null ? { ...seg, endAt: now } : seg,
        );
        const newState = STATUS_TO_SEGMENT[status];
        updates.timeSegments = newState
          ? [...closedSegments, { state: newState, startAt: now, endAt: null, note: note ?? null }]
          : closedSegments;
      } catch {
        /* non-blocking */
      }

      if (status === 'CANCELLED') {
        updates.cancelledAt = serverTimestamp();
        updates.cancelReason = note ?? null;
      }

      try {
        await updateDoc(doc(db, 'workOrders', id), updates);

        // Sync linked breakdown ticket progress.
        try {
          const snap = await getDoc(doc(db, 'workOrders', id));
          const data = snap.data() as any;
          if (data?.linkedBreakdownId) {
            const map: Partial<Record<WOStatus, BreakdownStatus>> = {
              OPEN: 'reported',
              ASSIGNED: 'assigned',
              IN_PROGRESS: 'repair_in_progress',
              ON_HOLD_PARTS: 'on_hold_parts',
              ON_HOLD_APPROVAL: 'on_hold_approval',
              COMPLETED: 'resolved',
              SIGNED_OFF: 'resolved',
              CLOSED: 'closed',
              CANCELLED: 'closed',
            };
            const bdStatus = map[status];
            if (bdStatus) {
              const bdUpdates: Record<string, unknown> = {
                status: bdStatus,
                statusHistory: arrayUnion({
                  status: bdStatus,
                  changedBy: user.uid,
                  changedByName: user.displayName ?? '',
                  changedAt: Timestamp.fromDate(new Date()),
                  note: `WO ${data.woNumber ?? id} status: ${status}`,
                }),
              };
              if (bdStatus === 'resolved') bdUpdates.resolvedAt = serverTimestamp();
              if (bdStatus === 'closed') bdUpdates.closedAt = serverTimestamp();
              await updateDoc(doc(db, 'breakdown_tickets', data.linkedBreakdownId), bdUpdates);
            }
          }
        } catch (bdErr) {
          console.error('Failed to sync breakdown progress', bdErr);
        }

        // Reflect the WO's live status on its linked PM schedule (PM Schedules
        // list, calendar and detail all read this).
        await syncPmScheduleWoStatus(id, status);

        toast.success(`Status updated to ${status.replace(/_/g, ' ')}`);
        return true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Status update failed';
        setError(msg);
        toast.error(msg);
        return false;
      } finally {
        setLoading(false);
      }
    },
    [user],
  );

  return { updateWO, updateStatus, loading, error };
}
