import { useEffect, useState } from 'react';
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
import type { WorkOrder, WORootCause } from '../types/workOrder';

// Standard 5-Whys question set.
export const FIVE_WHY_QUESTIONS = [
  'Why did the problem occur?',
  'Why did that happen?',
  'Why did that happen?',
  'Why did that happen?',
  'Why did that happen? (root)',
];

interface SaveWORCAData {
  problem: string;
  whys: string[];
  rootCauseEnum: WORootCause;
  rootCauseText: string;
  correctiveAction?: string;
  completed: boolean;
}

export function useWORCA(workOrder: WorkOrder | null) {
  const woId = workOrder?.id ?? '';
  const [rca, setRca] = useState<RCA | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!woId) {
      setLoading(false);
      return;
    }
    const q = query(
      collection(db, 'rca'),
      where('linkedWOId', '==', woId),
      orderBy('createdAt', 'desc'),
      limit(1),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setRca(snap.empty ? null : ({ id: snap.docs[0].id, ...snap.docs[0].data() } as RCA));
        setLoading(false);
      },
      () => setLoading(false),
    );
    return () => unsub();
  }, [woId]);

  async function saveWORCA(data: SaveWORCAData, uid: string, userName: string): Promise<string> {
    if (!workOrder) throw new Error('No work order');

    const whyEntries: WhyEntry[] = data.whys.map((answer, i) => ({
      question: FIVE_WHY_QUESTIONS[i] ?? `Why ${i + 1}?`,
      answer,
    }));
    const status: RCAStatus = data.completed ? 'completed' : 'open';

    let rcaId: string;
    if (rca) {
      await updateDoc(doc(db, 'rca', rca.id), {
        problem: data.problem,
        whys: whyEntries,
        rootCause: data.rootCauseText,
        correctiveAction: data.correctiveAction ?? null,
        status,
        updatedAt: serverTimestamp(),
      });
      rcaId = rca.id;
    } else {
      const docRef = await addDoc(collection(db, 'rca'), {
        breakdownId: workOrder.linkedBreakdownId ?? '',
        machineId: workOrder.machineId,
        siteId: workOrder.siteId,
        problem: data.problem,
        whys: whyEntries,
        rootCause: data.rootCauseText,
        correctiveAction: data.correctiveAction ?? null,
        linkedPmUpdate: null,
        linkedWOId: workOrder.id,
        status,
        createdBy: uid,
        createdByName: userName,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      rcaId = docRef.id;
    }

    // Mirror onto the WO (whitelist-safe fields).
    await updateDoc(doc(db, 'workOrders', workOrder.id), {
      rootCause: data.rootCauseEnum,
      rootCauseDescription: data.rootCauseText,
      updatedAt: serverTimestamp(),
    });

    return rcaId;
  }

  async function createCorrectiveWO(
    correctiveAction: string,
    uid: string,
    userName: string,
  ): Promise<string> {
    if (!workOrder) throw new Error('No work order');
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 7);
    const dueDateTs = Timestamp.fromDate(dueDate);

    const woRef = await addDoc(collection(db, 'workOrders'), {
      woNumber: 'CA-' + nanoid(6),
      siteId: workOrder.siteId,
      woType: 'CORRECTIVE',
      priority: 'high',
      status: 'OPEN',
      description: 'Corrective Action: ' + correctiveAction,
      ptwCategory: null,
      dueDate: dueDateTs,
      slaDeadline: dueDateTs,
      slaBreached: false,
      scheduledStart: null,
      estimatedDuration: 4,
      estimatedDurationUnit: 'hours',
      machineId: workOrder.machineId,
      machineName: workOrder.machineName,
      machineDepartment: workOrder.machineDepartment,
      machineLocation: workOrder.machineLocation,
      machineType: workOrder.machineType,
      machineCriticality: workOrder.machineCriticality,
      linkedBreakdownId: workOrder.linkedBreakdownId ?? null,
      linkedBreakdownTicketNumber: workOrder.linkedBreakdownTicketNumber ?? null,
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
      createdBy: uid,
      createdByName: userName,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      closedAt: null,
      cancelledAt: null,
      cancelReason: null,
    });

    return woRef.id;
  }

  return { rca, loading, saveWORCA, createCorrectiveWO };
}
