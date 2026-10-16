import type { Breakdown } from '../types/breakdown';

// ---------------------------------------------------------------------------
// Which tab a breakdown sits in, and who may see it
// ---------------------------------------------------------------------------

export type BreakdownBucket = 'reported' | 'assigned' | 'open' | 'closed';

const CLOSED_STATUSES = new Set<string>(['closed', 'cancelled']);
/** The ticket is finished as far as the technician's own job is concerned. */
const SUBMITTED_STATUSES = new Set<string>(['resolved', 'closed', 'cancelled']);

/** Roles that attend breakdowns themselves (and so own a ticket exclusively). */
export const ATTENDER_ROLES = ['technician', 'trainee'];

type TicketOwnership = Pick<Breakdown, 'attendedBy' | 'assignedBy'>;

/**
 * A technician who took a ticket on themselves, as opposed to one a
 * supervisor assigned (assignment stamps `assignedBy`, self-attend doesn't).
 */
export function isSelfAttended(b: TicketOwnership): boolean {
  return !!b.attendedBy && !b.assignedBy;
}

/**
 * The tab a ticket belongs to. A self-attended ticket goes straight to Open
 * (supervisors and above see it there with the attender's name); only a
 * supervisor's own assignment waits in Assigned.
 */
export function breakdownBucket(b: Pick<Breakdown, 'status' | 'attendedBy' | 'assignedBy'>): BreakdownBucket {
  if (CLOSED_STATUSES.has(b.status)) return 'closed';
  if (b.status === 'reported') return 'reported';
  if (b.status === 'assigned' && !isSelfAttended(b)) return 'assigned';
  return 'open';
}

/**
 * Once someone is attending a ticket, other technicians/trainees no longer
 * see it. Supervisors and above (and every other role) are unaffected, as
 * is anyone the ticket is assigned to — a work order adds its whole team
 * to `assignedTechnicianIds`, so teammates keep seeing it.
 */
export function isHiddenFromOthers(
  b: Pick<Breakdown, 'attendedBy' | 'assignedTechnicianIds'>,
  role: string | undefined,
  userId: string | undefined,
): boolean {
  if (!role || !ATTENDER_ROLES.includes(role)) return false;
  if (!b.attendedBy || b.attendedBy === userId) return false;
  if (userId && (b.assignedTechnicianIds ?? []).includes(userId)) return false;
  return true;
}

// ---------------------------------------------------------------------------
// Technician availability
// ---------------------------------------------------------------------------

export interface BusyInfo {
  kind: 'work_order' | 'breakdown';
  /** WO number or ticket number, for display. */
  ref: string;
  machineId: string | null;
  machineName: string | null;
}

/** Per-assignee / aggregate WO statuses that mean "has started and not finished". */
const WORKING_WO_STATUSES = new Set<string>(['IN_PROGRESS', 'ON_HOLD_PARTS', 'ON_HOLD_APPROVAL']);

export interface BusyWorkOrder {
  woNumber?: string;
  status: string;
  machineId?: string | null;
  machineName?: string | null;
  assignedTechnicianIds?: string[] | null;
  assigneeStates?: { technicianId: string; status: string }[] | null;
  assigneeCompletions?: { technicianId: string }[] | null;
}

export type BusyTicket = Pick<
  Breakdown,
  'status' | 'attendedBy' | 'severity' | 'linkedWOId' | 'ticketNumber' | 'machineId' | 'machineName'
> & { id: string };

export interface BusyOptions {
  /** Tickets whose attender should not count as busy (e.g. the one a WO is being created for). */
  ignoreBreakdownIds?: string[];
  /** Work on this machine doesn't make a technician unavailable for more work on the same machine. */
  allowMachineId?: string | null;
}

/**
 * Technicians who are mid-job and so can't be given another one.
 *
 * - A work order they have started (their own state if the WO tracks one per
 *   assignee, else the WO's status) and not yet submitted their completion for.
 * - A breakdown they are attending whose assessment/fix they haven't submitted
 *   yet. Submitting sets the severity, and from then on a non-low ticket
 *   continues under its work order, so a ticket with a severity (or a linked
 *   work order, or a resolved/closed status) no longer holds anyone.
 *
 * A work order is the more specific reason, so it wins when both apply.
 */
export function computeBusyTechnicians(
  workOrders: BusyWorkOrder[],
  tickets: BusyTicket[],
  opts: BusyOptions = {},
): Map<string, BusyInfo> {
  const busy = new Map<string, BusyInfo>();
  const ignored = new Set(opts.ignoreBreakdownIds ?? []);
  const allow = (machineId: string | null | undefined) =>
    !!opts.allowMachineId && machineId === opts.allowMachineId;

  for (const t of tickets) {
    if (!t.attendedBy || ignored.has(t.id)) continue;
    if (SUBMITTED_STATUSES.has(t.status) || t.severity || t.linkedWOId) continue;
    if (allow(t.machineId)) continue;
    busy.set(t.attendedBy, {
      kind: 'breakdown',
      ref: t.ticketNumber,
      machineId: t.machineId ?? null,
      machineName: t.machineName ?? null,
    });
  }

  for (const wo of workOrders) {
    if (!WORKING_WO_STATUSES.has(wo.status)) continue;
    if (allow(wo.machineId)) continue;
    const states = wo.assigneeStates ?? [];
    const completed = new Set((wo.assigneeCompletions ?? []).map((c) => c.technicianId));
    for (const id of wo.assignedTechnicianIds ?? []) {
      if (completed.has(id)) continue;
      const mine = states.find((s) => s.technicianId === id);
      // A WO that tracks per-person state only holds the people who started.
      const working = states.length > 0 ? !!mine && WORKING_WO_STATUSES.has(mine.status) : true;
      if (!working) continue;
      busy.set(id, {
        kind: 'work_order',
        ref: wo.woNumber ?? '',
        machineId: wo.machineId ?? null,
        machineName: wo.machineName ?? null,
      });
    }
  }

  return busy;
}
