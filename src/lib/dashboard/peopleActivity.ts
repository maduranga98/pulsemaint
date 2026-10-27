/**
 * What each person is doing right now, for the dashboard's Shift / Team
 * Status widgets: working a work order, attending a breakdown, or in a
 * training. Pure so it can be tested; the data comes from
 * `usePeopleActivity`.
 */

export type ActivityKind = 'workOrder' | 'breakdown' | 'training';

export interface PersonActivity {
  kind: ActivityKind;
  /** e.g. "WO-2026-0007 · Furnace 05" */
  label: string;
}

export interface ActivityWorkOrder {
  status: string;
  woNumber?: string | null;
  machineName?: string | null;
  assignedTechnicianIds?: string[] | null;
}

export interface ActivityTicket {
  status: string;
  ticketNumber?: string | null;
  machineName?: string | null;
  assignedTechnicianIds?: string[] | null;
  attendedBy?: string | null;
}

export interface ActivityTraining {
  status: string;
  traineeId: string;
  moduleName?: string | null;
  lastActivityAt?: { toMillis?: () => number } | null;
}

/** A training counts as "in a training" while it is in progress and was touched this recently. */
export const TRAINING_ACTIVE_WINDOW_MS = 3 * 60 * 60 * 1000;

/** Breakdown statuses in which someone is on their way to / repairing the machine. */
export const BREAKDOWN_ACTIVE_STATUSES = ['en_route', 'repair_in_progress'];

const joinLabel = (a?: string | null, b?: string | null) => [a, b].filter(Boolean).join(' · ');

export function buildPeopleActivity(
  input: { workOrders: ActivityWorkOrder[]; tickets: ActivityTicket[]; trainings: ActivityTraining[] },
  now: number = Date.now(),
): Map<string, PersonActivity[]> {
  const byUser = new Map<string, PersonActivity[]>();
  const add = (userId: string | null | undefined, activity: PersonActivity) => {
    if (!userId) return;
    const list = byUser.get(userId) ?? [];
    if (!list.some((a) => a.kind === activity.kind && a.label === activity.label)) list.push(activity);
    byUser.set(userId, list);
  };

  for (const wo of input.workOrders) {
    if (wo.status !== 'IN_PROGRESS') continue;
    for (const id of wo.assignedTechnicianIds ?? []) {
      add(id, { kind: 'workOrder', label: joinLabel(wo.woNumber, wo.machineName) });
    }
  }

  for (const tk of input.tickets) {
    if (!BREAKDOWN_ACTIVE_STATUSES.includes(tk.status)) continue;
    const people = new Set([...(tk.assignedTechnicianIds ?? []), ...(tk.attendedBy ? [tk.attendedBy] : [])]);
    for (const id of people) {
      add(id, { kind: 'breakdown', label: joinLabel(tk.ticketNumber, tk.machineName) });
    }
  }

  for (const tr of input.trainings) {
    if (tr.status !== 'in_progress') continue;
    const last = tr.lastActivityAt?.toMillis?.() ?? 0;
    if (!last || now - last > TRAINING_ACTIVE_WINDOW_MS) continue;
    add(tr.traineeId, { kind: 'training', label: tr.moduleName ?? '' });
  }

  return byUser;
}
