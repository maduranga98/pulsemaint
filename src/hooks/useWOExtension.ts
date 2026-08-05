import { useCallback, useEffect, useState } from 'react';
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
  orderBy,
  addDoc,
  arrayUnion,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuthStore } from '../store/authStore';
import type { WOExtensionRequest, WorkOrder } from '../types/workOrder';
import { toast } from 'sonner';

const COLLECTION = 'wo_extension_requests';

interface RequestExtensionPayload {
  reason: string;
  requestedDueDate: Date;
  requestedSlaDeadline?: Date | null;
}

/** Raise a due-date extension request for an overdue, unfinished WO. */
export function useRequestWOExtension() {
  const [loading, setLoading] = useState(false);
  const user = useAuthStore((s) => s.user);

  const requestExtension = useCallback(
    async (workOrder: WorkOrder, payload: RequestExtensionPayload): Promise<boolean> => {
      if (!user) return false;
      const profile = useAuthStore.getState().userProfile;
      if (!profile) return false;
      if (!payload.reason.trim()) {
        toast.error('A reason is required to request an extension.');
        return false;
      }
      setLoading(true);
      try {
        const requesterName = profile.fullName || user.displayName || '';
        const doc_: Omit<WOExtensionRequest, 'id'> = {
          woId: workOrder.id,
          woNumber: workOrder.woNumber,
          siteId: workOrder.siteId,
          companyId: profile.companyId,
          machineName: workOrder.machineName,
          requestedBy: user.uid,
          requestedByName: requesterName,
          requestedAt: Timestamp.now(),
          reason: payload.reason.trim(),
          requestedDueDate: Timestamp.fromDate(payload.requestedDueDate),
          requestedSlaDeadline: payload.requestedSlaDeadline
            ? Timestamp.fromDate(payload.requestedSlaDeadline)
            : null,
          previousDueDate: workOrder.dueDate,
          previousSlaDeadline: workOrder.slaDeadline ?? null,
          status: 'pending',
          reviewedBy: null,
          reviewedByName: null,
          reviewedAt: null,
          reviewNote: null,
          approvedDueDate: null,
          approvedSlaDeadline: null,
        };
        await addDoc(collection(db, COLLECTION), doc_);

        // Log the request on the WO's own status history so it shows up in
        // the normal timeline alongside creation/start/hold/sign-off.
        await updateDoc(doc(db, 'workOrders', workOrder.id), {
          statusHistory: arrayUnion({
            status: workOrder.status,
            changedBy: user.uid,
            changedByName: requesterName,
            changedAt: Timestamp.now(),
            note: `Extension requested by ${requesterName}: ${payload.reason.trim()} (new due: ${payload.requestedDueDate.toLocaleString()})`,
          }),
        });

        toast.success('Extension request sent for approval.');
        return true;
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to request extension');
        return false;
      } finally {
        setLoading(false);
      }
    },
    [user],
  );

  return { requestExtension, loading };
}

/** Live list of every extension request raised against a specific WO. */
export function useWOExtensionHistory(woId: string | null) {
  const [requests, setRequests] = useState<WOExtensionRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!woId) {
      setRequests([]);
      setLoading(false);
      return;
    }
    const q = query(collection(db, COLLECTION), where('woId', '==', woId), orderBy('requestedAt', 'desc'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setRequests(snap.docs.map((d) => ({ ...d.data(), id: d.id } as WOExtensionRequest)));
        setLoading(false);
      },
      () => setLoading(false),
    );
    return () => unsub();
  }, [woId]);

  return { requests, loading };
}

/** Live list of pending extension requests for a company — the supervisor /
 *  plant manager / admin dashboard approvals queue. */
export function usePendingWOExtensionRequests(companyId: string | null) {
  const [requests, setRequests] = useState<WOExtensionRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!companyId) {
      setRequests([]);
      setLoading(false);
      return;
    }
    const q = query(
      collection(db, COLLECTION),
      where('companyId', '==', companyId),
      where('status', '==', 'pending'),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const data = snap.docs.map((d) => ({ ...d.data(), id: d.id } as WOExtensionRequest));
        data.sort((a, b) => (b.requestedAt?.toMillis?.() ?? 0) - (a.requestedAt?.toMillis?.() ?? 0));
        setRequests(data);
        setLoading(false);
      },
      () => setLoading(false),
    );
    return () => unsub();
  }, [companyId]);

  return { requests, loading };
}

interface ReviewExtensionPayload {
  approve: boolean;
  /** Only used when approving — defaults to the requested date/time if omitted. */
  newDueDate?: Date;
  newSlaDeadline?: Date | null;
  reviewNote?: string;
}

/** Approve (optionally editing the date/time) or reject a pending extension
 *  request. Approving writes the new due date/SLA deadline straight onto the
 *  work order and logs it in the WO's status history. */
export function useReviewWOExtension() {
  const [loading, setLoading] = useState(false);
  const user = useAuthStore((s) => s.user);

  const reviewExtension = useCallback(
    async (request: WOExtensionRequest, payload: ReviewExtensionPayload): Promise<boolean> => {
      if (!user) return false;
      const profile = useAuthStore.getState().userProfile;
      if (!profile) return false;
      setLoading(true);
      try {
        const reviewerName = profile.fullName || user.displayName || '';
        const now = Timestamp.now();
        const woSnap = await getDoc(doc(db, 'workOrders', request.woId));
        const currentStatus = (woSnap.data()?.status as string | undefined) ?? 'IN_PROGRESS';

        if (payload.approve) {
          const finalDueDate = payload.newDueDate
            ? Timestamp.fromDate(payload.newDueDate)
            : request.requestedDueDate;
          const finalSlaDeadline = payload.newSlaDeadline
            ? Timestamp.fromDate(payload.newSlaDeadline)
            : payload.newSlaDeadline === null
            ? null
            : request.requestedSlaDeadline;

          await updateDoc(doc(db, COLLECTION, request.id), {
            status: 'approved',
            reviewedBy: user.uid,
            reviewedByName: reviewerName,
            reviewedAt: now,
            reviewNote: payload.reviewNote?.trim() || null,
            approvedDueDate: finalDueDate,
            approvedSlaDeadline: finalSlaDeadline,
          });

          const woUpdates: Record<string, unknown> = {
            dueDate: finalDueDate,
            slaBreached: false,
            statusHistory: arrayUnion({
              status: currentStatus as any,
              changedBy: user.uid,
              changedByName: reviewerName,
              changedAt: now,
              note: `Extension approved by ${reviewerName}: new due ${finalDueDate.toDate().toLocaleString()} (was ${request.previousDueDate.toDate().toLocaleString()})${payload.reviewNote ? ` — ${payload.reviewNote.trim()}` : ''}`,
            }),
            updatedAt: serverTimestamp(),
          };
          if (finalSlaDeadline) woUpdates.slaDeadline = finalSlaDeadline;
          await updateDoc(doc(db, 'workOrders', request.woId), woUpdates);

          toast.success('Extension approved and applied to the work order.');
        } else {
          await updateDoc(doc(db, COLLECTION, request.id), {
            status: 'rejected',
            reviewedBy: user.uid,
            reviewedByName: reviewerName,
            reviewedAt: now,
            reviewNote: payload.reviewNote?.trim() || null,
          });

          await updateDoc(doc(db, 'workOrders', request.woId), {
            statusHistory: arrayUnion({
              status: currentStatus as any,
              changedBy: user.uid,
              changedByName: reviewerName,
              changedAt: now,
              note: `Extension request rejected by ${reviewerName}${payload.reviewNote ? `: ${payload.reviewNote.trim()}` : ''}`,
            }),
            updatedAt: serverTimestamp(),
          });

          toast.success('Extension request rejected.');
        }
        return true;
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to review extension request');
        return false;
      } finally {
        setLoading(false);
      }
    },
    [user],
  );

  return { reviewExtension, loading };
}
