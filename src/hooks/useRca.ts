import { useState, useEffect, useCallback } from 'react';
import {
  collection,
  query,
  where,
  limit,
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
import type { Rca, RcaPayload } from '../types/rca';
import type { Breakdown } from '../types/breakdown';
import type { WOPriority } from '../types/workOrder';

function severityToPriority(severity: string): WOPriority {
  switch (severity) {
    case 'critical':
      return 'critical';
    case 'high':
      return 'high';
    case 'medium':
      return 'medium';
    default:
      return 'low';
  }
}

/**
 * Subscribes to the (single) RCA record linked to a breakdown and exposes a
 * save helper that writes to the `rca` collection. When a corrective action is
 * requested, an associated CORRECTIVE work order is auto-generated and linked.
 */
export function useRca(breakdownId: string | null | undefined) {
  const userProfile = useAuthStore((s) => s.userProfile);
  const [rca, setRca] = useState<Rca | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!breakdownId) {
      setRca(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const q = query(
      collection(db, 'rca'),
      where('breakdownId', '==', breakdownId),
      limit(1),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const d = snap.docs[0];
        setRca(d ? ({ ...d.data(), id: d.id } as Rca) : null);
        setLoading(false);
      },
      () => setLoading(false),
    );
    return () => unsub();
  }, [breakdownId]);

  const saveRca = useCallback(
    async (payload: RcaPayload, breakdown: Breakdown): Promise<Rca | null> => {
      if (!userProfile) {
        toast.error('You must be logged in to save an RCA.');
        return null;
      }
      const siteId = userProfile.siteIds[0] ?? userProfile.companyId;
      const companyId = userProfile.companyId;
      const userId = userProfile.id;
      const userName = userProfile.fullName ?? '';

      setSaving(true);
      try {
        // 1. Auto-generate a linked corrective-action Work Order if requested.
        let linkedWOId: string | null = rca?.linkedWOId ?? null;
        if (payload.createCorrectiveWorkOrder && !linkedWOId) {
          const priority = severityToPriority(payload.severity);
          const due = new Date();
          due.setDate(due.getDate() + 7);
          const woRef = await addDoc(collection(db, 'workOrders'), {
            companyId,
            siteId,
            woType: 'CORRECTIVE',
            priority,
            status: 'OPEN',
            description:
              payload.correctiveAction?.trim() ||
              `Corrective action from RCA — ${payload.problem}`.slice(0, 500),
            dueDate: Timestamp.fromDate(due),
            scheduledStart: null,
            estimatedDuration: 1,
            estimatedDurationUnit: 'hours',
            slaBreached: false,
            slaDeadline: null,
            woNumber: '',
            linkedBreakdownId: payload.breakdownId,
            linkedBreakdownTicketNumber: payload.breakdownTicketNumber,
            machineId: breakdown.machineId,
            machineName: breakdown.machineName,
            machineDepartment: breakdown.machineDepartment ?? '',
            machineLocation: breakdown.machineLocation ?? '',
            machineType: '',
            machineCriticality: breakdown.machineCriticality ?? 3,
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
            rootCauseDescription: payload.rootCause,
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
                note: 'Auto-generated from 5-Why RCA',
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
          linkedWOId = woRef.id;
        }

        // 2. Create or update the RCA record.
        const base = {
          companyId,
          siteId,
          breakdownId: payload.breakdownId,
          breakdownTicketNumber: payload.breakdownTicketNumber,
          machineId: payload.machineId,
          machineName: payload.machineName,
          severity: payload.severity,
          problem: payload.problem,
          whys: payload.whys,
          rootCause: payload.rootCause,
          correctiveAction: payload.correctiveAction ?? null,
          linkedWOId,
          linkedPmUpdate: rca?.linkedPmUpdate ?? null,
          status: payload.status,
          updatedAt: serverTimestamp(),
          completedAt: payload.status === 'completed' ? Timestamp.now() : rca?.completedAt ?? null,
        };

        let id = rca?.id ?? null;
        if (rca?.id) {
          await updateDoc(doc(db, 'rca', rca.id), base);
        } else {
          const ref = await addDoc(collection(db, 'rca'), {
            ...base,
            createdBy: userId,
            createdByName: userName,
            createdAt: serverTimestamp(),
          });
          id = ref.id;
        }

        toast.success(
          payload.status === 'completed' ? 'RCA completed.' : 'RCA saved.',
        );
        return id ? ({ ...(base as any), id } as Rca) : null;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to save RCA.';
        toast.error(msg);
        return null;
      } finally {
        setSaving(false);
      }
    },
    [userProfile, rca],
  );

  return { rca, loading, saving, saveRca };
}

/** Lists completed RCAs for a machine (failure-history tab). */
export function useMachineRcas(machineId: string | null | undefined) {
  const [rcas, setRcas] = useState<Rca[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!machineId) {
      setRcas([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const q = query(
      collection(db, 'rca'),
      where('machineId', '==', machineId),
      where('status', '==', 'completed'),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const items = snap.docs.map((d) => ({ ...d.data(), id: d.id } as Rca));
        items.sort((a, b) => (b.completedAt?.toMillis?.() ?? 0) - (a.completedAt?.toMillis?.() ?? 0));
        setRcas(items);
        setLoading(false);
      },
      () => setLoading(false),
    );
    return () => unsub();
  }, [machineId]);

  return { rcas, loading };
}
