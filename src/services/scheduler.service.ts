import {
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { durationToHours, type SchedulableJob } from '../lib/pm/schedulerConflict';

const TERMINAL_WO_STATUSES = ['CLOSED', 'CANCELLED', 'COMPLETED', 'SIGNED_OFF'];

function dayBounds(date: Date): { start: Date; end: Date } {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

/**
 * Authoritative server-side lookup of a technician's jobs on a given day.
 * Uses the composite index on assignedTechnicianIds (array-contains) +
 * nextDueDate / dueDate.
 */
export async function queryTechnicianDayJobs(
  companyId: string,
  technicianId: string,
  date: Date,
): Promise<SchedulableJob[]> {
  const { start, end } = dayBounds(date);
  const startTs = Timestamp.fromDate(start);
  const endTs = Timestamp.fromDate(end);

  const [pmSnap, woSnap] = await Promise.all([
    getDocs(
      query(
        collection(db, 'pm_schedules'),
        where('companyId', '==', companyId),
        where('assignedTechnicianIds', 'array-contains', technicianId),
        where('nextDueDate', '>=', startTs),
        where('nextDueDate', '<=', endTs),
      ),
    ),
    getDocs(
      query(
        collection(db, 'workOrders'),
        where('companyId', '==', companyId),
        where('assignedTechnicianIds', 'array-contains', technicianId),
        where('dueDate', '>=', startTs),
        where('dueDate', '<=', endTs),
      ),
    ),
  ]);

  const jobs: SchedulableJob[] = [];
  pmSnap.docs.forEach((d) => {
    const s = d.data() as any;
    jobs.push({
      id: d.id,
      source: 'pm_schedule',
      title: s.name,
      machineName: s.machineName,
      date: s.nextDueDate?.toDate?.() ?? date,
      estimatedHours: durationToHours(s.estimatedDuration, s.estimatedDurationUnit),
      priority: s.priority,
      assignedTechnicianIds: s.assignedTechnicianIds ?? [],
      assignedTechnicianNames: s.assignedTechnicianNames ?? [],
    });
  });
  woSnap.docs.forEach((d) => {
    const w = d.data() as any;
    if (TERMINAL_WO_STATUSES.includes(w.status)) return;
    const unit = (w.estimatedDurationUnit === 'days' ? 'days' : 'hours') as 'hours' | 'days';
    jobs.push({
      id: d.id,
      source: 'work_order',
      title: w.description?.slice(0, 60) || w.woNumber || 'Preventive WO',
      machineName: w.machineName ?? 'Unknown',
      date: w.dueDate?.toDate?.() ?? date,
      estimatedHours: durationToHours(Number(w.estimatedDuration ?? 1), unit),
      priority: w.priority ?? 'medium',
      assignedTechnicianIds: w.assignedTechnicianIds ?? [],
      assignedTechnicianNames: w.assignedTechnicianNames ?? [],
    });
  });
  return jobs;
}

/**
 * Reassigns a job to exactly one technician (used by drag-and-drop and the
 * assignment modal). Pass an empty technicianId to unassign.
 */
export async function reassignJobTechnician(
  job: SchedulableJob,
  technicianId: string,
  technicianName: string,
): Promise<void> {
  const collectionName = job.source === 'pm_schedule' ? 'pm_schedules' : 'workOrders';
  const ids = technicianId ? [technicianId] : [];
  const names = technicianId ? [technicianName] : [];
  await updateDoc(doc(db, collectionName, job.id), {
    assignedTechnicianIds: ids,
    assignedTechnicianNames: names,
    updatedAt: serverTimestamp(),
  });
}

/** Adds a technician to a job's existing assignment (no removal). */
export async function addJobTechnician(
  job: SchedulableJob,
  technicianId: string,
  technicianName: string,
): Promise<void> {
  if (job.assignedTechnicianIds.includes(technicianId)) return;
  const collectionName = job.source === 'pm_schedule' ? 'pm_schedules' : 'workOrders';
  await updateDoc(doc(db, collectionName, job.id), {
    assignedTechnicianIds: [...job.assignedTechnicianIds, technicianId],
    assignedTechnicianNames: [...job.assignedTechnicianNames, technicianName],
    updatedAt: serverTimestamp(),
  });
}
