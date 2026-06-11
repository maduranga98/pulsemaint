import { useState, useEffect, useMemo } from 'react';
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
import { nanoid } from 'nanoid';
import { db } from '../lib/firebase';
import type { MaintenanceBacklogItem, CreateBacklogItemPayload } from '../types/backlog';
import { computeRiskScore } from '../lib/backlogUtils';

interface UseBacklogParams {
  siteId: string;
}

export function useBacklog({ siteId }: UseBacklogParams) {
  const [items, setItems] = useState<MaintenanceBacklogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!siteId) {
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'maintenanceBacklog'),
      where('siteId', '==', siteId),
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const raw = snap.docs.map((d) => ({ id: d.id, ...d.data() } as MaintenanceBacklogItem));
        // Sort client-side by riskScore desc, then createdAt desc
        raw.sort((a, b) => {
          if (b.riskScore !== a.riskScore) return b.riskScore - a.riskScore;
          const aMs = (a.createdAt as any)?.toMillis?.() ?? 0;
          const bMs = (b.createdAt as any)?.toMillis?.() ?? 0;
          return bMs - aMs;
        });
        setItems(raw);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );

    return () => unsub();
  }, [siteId]);

  const highRiskAlerts = useMemo(
    () =>
      items.filter(
        (item) =>
          item.riskScore >= 15 &&
          item.machineCriticality <= 2 &&
          item.status === 'open',
      ),
    [items],
  );

  async function addItem(
    payload: CreateBacklogItemPayload,
    uid: string,
    userName: string,
  ): Promise<string> {
    const riskScore = computeRiskScore(payload.likelihood, payload.consequence);
    const docRef = await addDoc(collection(db, 'maintenanceBacklog'), {
      siteId,
      machineId: payload.machineId,
      machineName: payload.machineName,
      machineLocation: payload.machineLocation,
      machineDepartment: payload.machineDepartment,
      machineCriticality: payload.machineCriticality,
      description: payload.description,
      deferredReason: payload.deferredReason,
      likelihood: payload.likelihood,
      consequence: payload.consequence,
      riskScore,
      status: 'open',
      linkedWOId: null,
      identifiedAt: serverTimestamp(),
      createdBy: uid,
      createdByName: userName,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return docRef.id;
  }

  async function promoteToWO(
    item: MaintenanceBacklogItem,
    uid: string,
    userName: string,
  ): Promise<string> {
    let priority: 'high' | 'medium' | 'low';
    if (item.riskScore >= 15) priority = 'high';
    else if (item.riskScore >= 10) priority = 'medium';
    else priority = 'low';

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 7);
    const dueDateTs = Timestamp.fromDate(dueDate);

    const woRef = await addDoc(collection(db, 'workOrders'), {
      woNumber: 'BL-' + nanoid(6),
      siteId: item.siteId,
      woType: 'CORRECTIVE',
      priority,
      status: 'OPEN',
      description: item.description,
      ptwCategory: null,
      machineId: item.machineId,
      machineName: item.machineName,
      machineDepartment: item.machineDepartment,
      machineLocation: item.machineLocation,
      machineType: 'other',
      machineCriticality: item.machineCriticality,
      linkedBreakdownId: null,
      linkedBreakdownTicketNumber: null,
      supervisorInChargeId: uid,
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
      statusHistory: [],
      timeSegments: [],
      dueDate: dueDateTs,
      slaDeadline: dueDateTs,
      slaBreached: false,
      scheduledStart: null,
      estimatedDuration: 4,
      estimatedDurationUnit: 'hours',
      createdBy: uid,
      createdByName: userName,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      closedAt: null,
      cancelledAt: null,
      cancelReason: null,
    });

    // Update backlog item
    await updateDoc(doc(db, 'maintenanceBacklog', item.id), {
      status: 'scheduled',
      linkedWOId: woRef.id,
      updatedAt: serverTimestamp(),
    });

    return woRef.id;
  }

  async function closeItem(id: string): Promise<boolean> {
    try {
      await updateDoc(doc(db, 'maintenanceBacklog', id), {
        status: 'closed',
        updatedAt: serverTimestamp(),
      });
      return true;
    } catch {
      return false;
    }
  }

  return {
    items,
    loading,
    error,
    highRiskAlerts,
    addItem,
    promoteToWO,
    closeItem,
  };
}
