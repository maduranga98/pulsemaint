import { collection, doc, getDoc, getDocs, query, updateDoc, where } from 'firebase/firestore';
import { db } from './firebase';

// Breakdown/WO statuses that mean the incident is no longer open work for
// the machine. Kept in sync with BreakdownsPage's closedSet and
// WOListView's TERMINAL_STATUSES — duplicated here rather than imported so
// this module has no dependency on either page.
const CLOSED_BREAKDOWN_STATUSES = new Set(['resolved', 'closed', 'cancelled']);
const TERMINAL_WO_STATUSES = new Set(['SIGNED_OFF', 'CLOSED', 'CANCELLED']);

/**
 * Flip a machine to 'under_maintenance' the moment a breakdown or work order
 * against it becomes open (reported/assigned/created). Never touches a
 * 'decommissioned' machine. Deliberately a one-way, single-doc write with no
 * cross-collection read — every role that can open a breakdown/WO already
 * has write access to the machine doc (technicians included, for the
 * `status` field — see firestore.rules), so this never trips a permissions
 * error the way recomputing "is anything else still open" would for a
 * technician who can only read their own assigned work orders.
 */
export async function markMachineUnderMaintenance(machineId: string | null | undefined): Promise<void> {
  if (!machineId) return;
  try {
    const machineRef = doc(db, 'machines', machineId);
    const machineSnap = await getDoc(machineRef);
    if (!machineSnap.exists()) return;
    const currentStatus = (machineSnap.data() as { status?: string }).status;
    if (currentStatus === 'decommissioned' || currentStatus === 'under_maintenance') return;
    await updateDoc(machineRef, { status: 'under_maintenance' });
  } catch (err) {
    console.error('Failed to mark machine under maintenance', err);
  }
}

/**
 * Flip a machine back to 'active' once a breakdown or work order against it
 * closes — but only if nothing else open remains on it (a machine can have
 * more than one concurrent ticket/WO). Never touches a 'decommissioned'
 * machine.
 *
 * Requires read access to every breakdown_tickets/workOrders doc for this
 * machine, which only the closing-capable roles have (supervisor, plant
 * manager, admin — see firestore.rules); call this only from breakdown-close
 * and WO sign-off/completion flows, which are already gated to those roles.
 * Best-effort: failures are swallowed so a permissions hiccup never blocks
 * the close/sign-off action that triggered it.
 */
export async function markMachineActiveIfNoOpenWork(machineId: string | null | undefined): Promise<void> {
  if (!machineId) return;
  try {
    const machineRef = doc(db, 'machines', machineId);
    const machineSnap = await getDoc(machineRef);
    if (!machineSnap.exists()) return;
    const currentStatus = (machineSnap.data() as { status?: string }).status;
    if (currentStatus === 'decommissioned' || currentStatus === 'active') return;

    const [breakdownSnap, woSnap] = await Promise.all([
      getDocs(query(collection(db, 'breakdown_tickets'), where('machineId', '==', machineId))),
      getDocs(query(collection(db, 'workOrders'), where('machineId', '==', machineId))),
    ]);
    const hasOpenBreakdown = breakdownSnap.docs.some(
      (d) => !CLOSED_BREAKDOWN_STATUSES.has((d.data() as { status?: string }).status ?? ''),
    );
    const hasOpenWO = woSnap.docs.some(
      (d) => !TERMINAL_WO_STATUSES.has((d.data() as { status?: string }).status ?? ''),
    );
    if (hasOpenBreakdown || hasOpenWO) return;

    await updateDoc(machineRef, { status: 'active' });
  } catch (err) {
    console.error('Failed to reactivate machine after close', err);
  }
}
