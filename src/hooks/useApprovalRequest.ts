import { useCallback, useState } from 'react';
import { doc, getDoc, updateDoc, arrayUnion, serverTimestamp, Timestamp } from 'firebase/firestore';
import { toast } from 'sonner';
import { db } from '../lib/firebase';
import { notifyUsers } from '../services/notifications.service';
import { aggregateWoStatus } from '../lib/workorders/assigneeState';
import type { AssigneeWorkState, WOApprovalRequest, WOApprovalRequestStatus, WorkOrder } from '../types/workOrder';

interface UseApprovalRequestResult {
  requestApproval: (
    woId: string,
    companyId: string,
    technicianId: string,
    technicianName: string,
    note: string,
  ) => Promise<boolean>;
  resolveApprovalRequest: (
    woId: string,
    companyId: string,
    requestId: string,
    decision: Exclude<WOApprovalRequestStatus, 'pending'>,
    resolverId: string,
    resolverName: string,
    resolutionNote: string,
  ) => Promise<boolean>;
  loading: boolean;
}

/**
 * Raises and resolves "Hold · Approval" requests — a technician asking a
 * supervisor to sign off on something outside their own authority before
 * they can continue. Requests are kept as a running log on the WO
 * (`approvalRequests`) so the full history — every request, its note, and
 * how/when it was resolved — is always visible on the work order, not just
 * the current pending one.
 */
export function useApprovalRequest(): UseApprovalRequestResult {
  const [loading, setLoading] = useState(false);

  const requestApproval = useCallback(
    async (woId: string, companyId: string, technicianId: string, technicianName: string, note: string): Promise<boolean> => {
      setLoading(true);
      try {
        const ref = doc(db, 'workOrders', woId);
        const snap = await getDoc(ref);
        const wo = snap.data() as WorkOrder | undefined;
        if (!wo) throw new Error('Work order not found');

        const request: WOApprovalRequest = {
          id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
          technicianId,
          technicianName,
          note: note.trim(),
          requestedAt: Timestamp.now(),
          status: 'pending',
          resolvedBy: null,
          resolvedByName: null,
          resolvedAt: null,
          resolutionNote: null,
        };

        await updateDoc(ref, {
          approvalRequests: arrayUnion(request),
          statusHistory: arrayUnion({
            status: 'ON_HOLD_APPROVAL',
            changedBy: technicianId,
            changedByName: technicianName,
            changedAt: request.requestedAt,
            note: `Requested approval: ${request.note}`,
          }),
          updatedAt: serverTimestamp(),
        });

        if (wo.supervisorInChargeId) {
          void notifyUsers(companyId, [wo.supervisorInChargeId], {
            type: 'work_order',
            message: `${technicianName} requested your approval on ${wo.woNumber || 'a work order'}: ${request.note}`,
            oversightMessage: `requested approval from ${wo.supervisorInChargeName || 'the supervisor'} on ${wo.woNumber || 'a work order'}`,
            actorName: technicianName,
            actorUserId: technicianId,
            severity: 'medium',
            linkTo: '/app/work-orders',
          });
        }
        return true;
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to send approval request');
        return false;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const resolveApprovalRequest = useCallback(
    async (
      woId: string,
      companyId: string,
      requestId: string,
      decision: Exclude<WOApprovalRequestStatus, 'pending'>,
      resolverId: string,
      resolverName: string,
      resolutionNote: string,
    ): Promise<boolean> => {
      setLoading(true);
      try {
        const ref = doc(db, 'workOrders', woId);
        const snap = await getDoc(ref);
        const wo = snap.data() as WorkOrder | undefined;
        if (!wo) throw new Error('Work order not found');

        const existing = wo.approvalRequests ?? [];
        const target = existing.find((r) => r.id === requestId);
        if (!target) throw new Error('Request not found');

        const now = Timestamp.now();
        const nextRequests = existing.map((r) =>
          r.id === requestId
            ? {
                ...r,
                status: decision,
                resolvedBy: resolverId,
                resolvedByName: resolverName,
                resolvedAt: now,
                resolutionNote: resolutionNote.trim() || null,
              }
            : r,
        );

        // On approval, resume the requesting technician's own work — their
        // ON_HOLD_APPROVAL state flips back to IN_PROGRESS, and the shared WO
        // status is re-derived so the ticket doesn't sit stuck on hold once
        // the thing blocking it has been signed off.
        const existingStates = wo.assigneeStates ?? [];
        const priorState = existingStates.find((s) => s.technicianId === target.technicianId);
        let nextStates: AssigneeWorkState[] = existingStates;
        let nextStatus = wo.status;
        let resumed = false;

        if (decision === 'approved') {
          if (priorState && priorState.status === 'ON_HOLD_APPROVAL') {
            nextStates = existingStates.map((s) =>
              s.technicianId === target.technicianId
                ? { ...s, status: 'IN_PROGRESS', holdReason: '', updatedAt: now }
                : s,
            );
            const completedIds = new Set((wo.assigneeCompletions ?? []).map((c) => c.technicianId));
            nextStatus = aggregateWoStatus(nextStates, completedIds, wo.status);
            resumed = true;
          } else if (!priorState && wo.status === 'ON_HOLD_APPROVAL') {
            // Legacy/single-assignee WO with no per-assignee record — the
            // whole WO was held for this approval.
            nextStatus = 'IN_PROGRESS';
            resumed = true;
          }
        }

        await updateDoc(ref, {
          approvalRequests: nextRequests,
          ...(nextStates !== existingStates ? { assigneeStates: nextStates } : {}),
          status: nextStatus,
          statusHistory: arrayUnion({
            status: nextStatus,
            changedBy: resolverId,
            changedByName: resolverName,
            changedAt: now,
            note: `${decision === 'approved' ? 'Approved' : 'Rejected'} approval request from ${target.technicianName}${
              resolutionNote.trim() ? `: ${resolutionNote.trim()}` : ''
            }${resumed ? ' — work resumed' : ''}`,
          }),
          updatedAt: serverTimestamp(),
        });

        void notifyUsers(companyId, [target.technicianId], {
          type: 'work_order',
          message: `Your approval request on ${wo.woNumber || 'a work order'} was ${decision}${
            resolutionNote.trim() ? `: ${resolutionNote.trim()}` : ''
          }${resumed ? ' — your work has resumed' : ''}`,
          oversightMessage: `${decision} ${target.technicianName}'s approval request on ${wo.woNumber || 'a work order'}`,
          actorName: resolverName,
          actorUserId: resolverId,
          severity: decision === 'rejected' ? 'high' : 'medium',
          linkTo: '/app/work-orders',
        });
        return true;
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to resolve approval request');
        return false;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  return { requestApproval, resolveApprovalRequest, loading };
}
