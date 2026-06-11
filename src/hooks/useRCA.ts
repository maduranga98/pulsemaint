import { useState, useEffect } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { nanoid } from 'nanoid';
import { db } from '../lib/firebase';
import type { RCA, WhyEntry, RCAStatus } from '../types/rca';

interface UseRCAParams {
  breakdownId: string;
  machineId: string;
  siteId: string;
}

interface SaveRCAData {
  problem: string;
  whys: WhyEntry[];
  rootCause: string;
  correctiveAction?: string;
  linkedPmUpdate?: string;
  status: RCAStatus;
}

export function useRCA({ breakdownId, machineId, siteId }: UseRCAParams) {
  const [rca, setRca] = useState<RCA | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!breakdownId) {
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'rca'),
      where('breakdownId', '==', breakdownId),
      orderBy('createdAt', 'desc'),
      limit(1),
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        if (snap.empty) {
          setRca(null);
        } else {
          const docSnap = snap.docs[0];
          setRca({ id: docSnap.id, ...docSnap.data() } as RCA);
        }
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );

    return () => unsub();
  }, [breakdownId]);

  async function saveRCA(
    data: SaveRCAData,
    uid: string,
    userName: string,
  ): Promise<string> {
    if (rca) {
      // Update existing
      await updateDoc(doc(db, 'rca', rca.id), {
        problem: data.problem,
        whys: data.whys,
        rootCause: data.rootCause,
        correctiveAction: data.correctiveAction ?? null,
        linkedPmUpdate: data.linkedPmUpdate ?? null,
        status: data.status,
        updatedAt: serverTimestamp(),
      });
      return rca.id;
    } else {
      // Create new
      const docRef = await addDoc(collection(db, 'rca'), {
        breakdownId,
        machineId,
        siteId,
        problem: data.problem,
        whys: data.whys,
        rootCause: data.rootCause,
        correctiveAction: data.correctiveAction ?? null,
        linkedPmUpdate: data.linkedPmUpdate ?? null,
        linkedWOId: null,
        status: data.status,
        createdBy: uid,
        createdByName: userName,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return docRef.id;
    }
  }

  async function createCorrectiveActionWO(
    rcaDoc: RCA,
    uid: string,
    userName: string,
  ): Promise<string> {
    const now = Timestamp.now();
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 7);
    const dueDateTs = Timestamp.fromDate(dueDate);

    const woRef = await addDoc(collection(db, 'workOrders'), {
      woNumber: 'CA-' + nanoid(6),
      siteId: rcaDoc.siteId,
      woType: 'CORRECTIVE',
      priority: 'high',
      status: 'OPEN',
      description: 'Corrective Action: ' + rcaDoc.correctiveAction,
      ptwCategory: null,
      machineId: rcaDoc.machineId,
      machineName: '',
      machineDepartment: '',
      machineLocation: '',
      machineType: 'other',
      machineCriticality: 3,
      linkedBreakdownId: rcaDoc.breakdownId,
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

    // Update RCA with the linked WO id
    await updateDoc(doc(db, 'rca', rcaDoc.id), {
      linkedWOId: woRef.id,
      updatedAt: serverTimestamp(),
    });

    return woRef.id;
  }

  const hasRCA = rca !== null;
  const rcaStarted = rca !== null;

  return {
    rca,
    loading,
    error,
    hasRCA,
    rcaStarted,
    saveRCA,
    createCorrectiveActionWO,
  };
}
