import { collection, getDocs, query, serverTimestamp, where, writeBatch } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { limitsForCompany } from '../lib/planLimits';
import { fetchResourceCount } from '../hooks/usePlanLimitCheck';

const MARK = 'machine_scrapped';
type CompanyForLimits = Parameters<typeof limitsForCompany>[0];

/**
 * A scrapped machine has nothing left to service: its active PM schedules are archived,
 * which stops work orders being generated and frees them from the plan's PM schedule count.
 * They are marked so that undoing the scrap can bring back exactly these ones.
 */
export async function archiveSchedulesForScrap(companyId: string, machineId: string): Promise<number> {
  const snap = await getDocs(query(collection(db, 'pm_schedules'),
    where('companyId', '==', companyId), where('machineId', '==', machineId), where('status', '==', 'active')));
  if (snap.empty) return 0;
  const batch = writeBatch(db);
  snap.docs.forEach((d) => batch.update(d.ref, { status: 'archived', archivedReason: MARK, updatedAt: serverTimestamp() }));
  await batch.commit();
  return snap.size;
}

/** Undo of the above: re-activates the schedules archived by the scrap, as far as the plan's PM schedule limit allows. */
export async function restoreSchedulesAfterUnscrap(
  company: CompanyForLimits, companyId: string, machineId: string,
): Promise<{ restored: number; left: number }> {
  const snap = await getDocs(query(collection(db, 'pm_schedules'),
    where('companyId', '==', companyId), where('machineId', '==', machineId), where('archivedReason', '==', MARK)));
  if (snap.empty) return { restored: 0, left: 0 };
  const limit = limitsForCompany(company).pmSchedules;
  const room = limit === null ? snap.size : Math.max(0, limit - (await fetchResourceCount('pmSchedules', companyId)));
  const docs = snap.docs.slice(0, room);
  if (docs.length) {
    const batch = writeBatch(db);
    docs.forEach((d) => batch.update(d.ref, { status: 'active', archivedReason: null, updatedAt: serverTimestamp() }));
    await batch.commit();
  }
  return { restored: docs.length, left: snap.size - docs.length };
}
