import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import {
  computeBusyTechnicians,
  type BusyInfo,
  type BusyOptions,
  type BusyTicket,
  type BusyWorkOrder,
} from '../lib/breakdownWorkflow';

interface FetchBusyArgs extends BusyOptions {
  siteId: string;
  /**
   * Check a single technician (their own availability). Technicians can only
   * read work orders they are assigned to, so this narrows both queries to
   * what they are allowed to see. Omit to check the whole site (supervisors
   * and above, picking someone to assign).
   */
  selfId?: string;
}

/**
 * Technicians who are mid-job right now — see `computeBusyTechnicians` for
 * what counts. Read fresh on demand (when a picker opens or a technician
 * takes a job) rather than kept as a live listener: it only matters at the
 * moment of choosing, and a stale answer there is worse than a few reads.
 *
 * Best effort: if either read is refused the technicians are treated as
 * available rather than blocking the whole assignment flow.
 */
export async function fetchBusyTechnicians({
  siteId,
  selfId,
  ignoreBreakdownIds,
  allowMachineId,
}: FetchBusyArgs): Promise<Map<string, BusyInfo>> {
  if (!siteId) return new Map();

  const woQuery = selfId
    ? query(collection(db, 'workOrders'), where('assignedTechnicianIds', 'array-contains', selfId))
    : query(
        collection(db, 'workOrders'),
        where('siteId', '==', siteId),
        where('status', 'in', ['IN_PROGRESS', 'ON_HOLD_PARTS', 'ON_HOLD_APPROVAL']),
      );
  // Unsubmitted tickets always have a null severity (the attender sets it on
  // submit), which keeps this off the site's whole ticket history.
  const ticketQuery = selfId
    ? query(collection(db, 'breakdown_tickets'), where('siteId', '==', siteId), where('attendedBy', '==', selfId))
    : query(collection(db, 'breakdown_tickets'), where('siteId', '==', siteId), where('severity', '==', null));

  const [woSnap, ticketSnap] = await Promise.all([
    getDocs(woQuery).catch(() => null),
    getDocs(ticketQuery).catch(() => null),
  ]);

  const workOrders = (woSnap?.docs ?? []).map((d) => d.data() as BusyWorkOrder);
  const tickets = (ticketSnap?.docs ?? []).map((d) => ({ ...(d.data() as Omit<BusyTicket, 'id'>), id: d.id }));
  const busy = computeBusyTechnicians(workOrders, tickets, { ignoreBreakdownIds, allowMachineId });
  return selfId ? new Map([...busy].filter(([id]) => id === selfId)) : busy;
}
