import { useState, useEffect, useCallback } from 'react';
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuthStore } from '../store/authStore';
import { toast } from 'sonner';
import {
  computeRiskScore,
  isHighRiskCritical,
  type BacklogItem,
  type CreateBacklogPayload,
} from '../types/backlog';
import type { WOPriority } from '../types/workOrder';

function criticalityToPriority(criticality: number): WOPriority {
  if (criticality >= 5) return 'critical';
  if (criticality === 4) return 'high';
  if (criticality === 3) return 'medium';
  return 'low';
}

/** Writes a manager alert to the `notifications` feed (surfaced on the dashboard). */
async function pushManagerAlert(
  companyId: string,
  item: { machineName: string; riskScore: number; id: string },
) {
  try {
    await addDoc(collection(db, 'notifications'), {
      companyId,
      type: 'alert',
      severity: 'critical',
      message: `High-risk deferred maintenance on critical machine ${item.machineName} (risk score ${item.riskScore}).`,
      timestamp: serverTimestamp(),
      linkTo: '/app/work-orders?tab=backlog',
      read: false,
      audience: 'plant_manager',
      source: 'backlog',
      backlogItemId: item.id,
    });
  } catch (err) {
    console.error('Failed to push manager alert for backlog item', err);
  }
}

export function useBacklog() {
  const userProfile = useAuthStore((s) => s.userProfile);
  const companyId = userProfile?.companyId;
  const [items, setItems] = useState<BacklogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    const q = query(collection(db, 'backlog'), where('companyId', '==', companyId));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setItems(snap.docs.map((d) => ({ ...d.data(), id: d.id } as BacklogItem)));
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );
    return () => unsub();
  }, [companyId]);

  const createBacklogItem = useCallback(
    async (payload: CreateBacklogPayload): Promise<string | null> => {
      if (!userProfile || !companyId) {
        toast.error('You must be logged in.');
        return null;
      }
      const siteId = userProfile.siteIds[0] ?? companyId;
      const riskScore = computeRiskScore(payload.likelihood, payload.consequence);
      try {
        const ref = await addDoc(collection(db, 'backlog'), {
          companyId,
          siteId,
          machineId: payload.machineId,
          machineName: payload.machineName,
          machineCriticality: payload.machineCriticality,
          machineFlaggedCritical: payload.machineFlaggedCritical,
          description: payload.description,
          identifiedAt: Timestamp.now(),
          deferredReason: payload.deferredReason,
          likelihood: payload.likelihood,
          consequence: payload.consequence,
          riskScore,
          status: 'open',
          linkedWOId: null,
          linkedWONumber: null,
          createdBy: userProfile.id,
          createdByName: userProfile.fullName ?? '',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        if (isHighRiskCritical({ riskScore, machineFlaggedCritical: payload.machineFlaggedCritical })) {
          await pushManagerAlert(companyId, {
            machineName: payload.machineName,
            riskScore,
            id: ref.id,
          });
        }
        toast.success('Backlog item added.');
        return ref.id;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to add backlog item.';
        toast.error(msg);
        return null;
      }
    },
    [userProfile, companyId],
  );

  /** Promotes a backlog item into a scheduled Work Order and links it. */
  const promoteToWorkOrder = useCallback(
    async (item: BacklogItem): Promise<string | null> => {
      if (!userProfile || !companyId) {
        toast.error('You must be logged in.');
        return null;
      }
      const siteId = userProfile.siteIds[0] ?? companyId;
      const userId = userProfile.id;
      const userName = userProfile.fullName ?? '';
      try {
        const due = new Date();
        due.setDate(due.getDate() + 14);
        const woRef = await addDoc(collection(db, 'workOrders'), {
          companyId,
          siteId,
          woType: 'PREVENTIVE',
          priority: criticalityToPriority(item.machineCriticality),
          status: 'OPEN',
          description: `Deferred maintenance: ${item.description}`.slice(0, 500),
          dueDate: Timestamp.fromDate(due),
          scheduledStart: Timestamp.fromDate(due),
          estimatedDuration: 1,
          estimatedDurationUnit: 'hours',
          slaBreached: false,
          slaDeadline: null,
          woNumber: '',
          linkedBreakdownId: null,
          linkedBreakdownTicketNumber: null,
          machineId: item.machineId,
          machineName: item.machineName,
          machineDepartment: '',
          machineLocation: '',
          machineType: '',
          machineCriticality: item.machineCriticality,
          supervisorInChargeId: userId,
          supervisorInChargeName: userName,
          assignedTechnicianIds: [],
          assignedTechnicianNames: [],
          contractorCompanyId: null,
          contractorCompanyName: null,
          contractorContactPerson: null,
          contractorContactNumber: null,
          contractorTechnicianNames: [],
          isManualContractor: false,
          checklist: [],
          documents: [],
          partsRequests: [],
          actualStartTime: null,
          actualEndTime: null,
          totalDurationMinutes: null,
          workDoneDescription: null,
          rootCause: null,
          rootCauseDescription: null,
          partsUsed: [],
          technicianWorkLogs: [],
          contractorHoursLog: null,
          postRepairChecklist: [],
          testRunResult: null,
          testRunNotes: null,
          finalPhotos: [],
          machineStatusAfterRepair: null,
          supervisorSignOffSignature: null,
          supervisorSignOffBy: null,
          supervisorSignOffAt: null,
          supervisorSignOffNotes: null,
          statusHistory: [
            {
              status: 'OPEN',
              changedBy: userId,
              changedByName: userName,
              changedAt: Timestamp.now(),
              note: 'Promoted from maintenance backlog',
            },
          ],
          createdBy: userId,
          createdByName: userName,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          closedAt: null,
          cancelledAt: null,
          cancelReason: null,
        });

        await updateDoc(doc(db, 'backlog', item.id), {
          status: 'scheduled',
          linkedWOId: woRef.id,
          updatedAt: serverTimestamp(),
        });
        toast.success('Promoted to a scheduled Work Order.');
        return woRef.id;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to promote backlog item.';
        toast.error(msg);
        return null;
      }
    },
    [userProfile, companyId],
  );

  const updateStatus = useCallback(
    async (itemId: string, status: BacklogItem['status']) => {
      try {
        await updateDoc(doc(db, 'backlog', itemId), { status, updatedAt: serverTimestamp() });
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to update item.');
      }
    },
    [],
  );

  return { items, loading, error, createBacklogItem, promoteToWorkOrder, updateStatus };
}
