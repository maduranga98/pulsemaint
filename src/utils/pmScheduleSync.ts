import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';

/**
 * Reflect a preventive work order's current status on its linked PM schedule so
 * PM Schedules, PM Calendar and the schedule detail view update automatically
 * as the WO progresses (started, on hold, completed, signed off, cancelled).
 *
 * A no-op for non-PM WOs or WOs that aren't tied to a schedule. Always
 * non-blocking — failures are logged, never thrown, so the primary WO write is
 * never rolled back because of a downstream sync issue.
 */
export async function syncPmScheduleWoStatus(woId: string, status: string): Promise<void> {
  try {
    const woSnap = await getDoc(doc(db, 'workOrders', woId));
    const woData = woSnap.data() as { woType?: string; pmScheduleId?: string | null } | undefined;
    if (!woData || woData.woType !== 'PREVENTIVE' || !woData.pmScheduleId) return;

    await updateDoc(doc(db, 'pm_schedules', woData.pmScheduleId), {
      activeWoId: woId,
      activeWoStatus: status,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    console.error('Failed to sync PM schedule work status', err);
  }
}
