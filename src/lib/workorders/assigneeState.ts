import type {
  AssigneeWorkState,
  AssigneeWorkStatus,
  WorkOrder,
  WOStatus,
} from '../../types/workOrder';

/** The status a single person sees for their own part of a work order. */
export type MyWorkStatus = 'NOT_STARTED' | AssigneeWorkStatus | 'COMPLETED';

const TERMINAL: WOStatus[] = ['COMPLETED', 'SIGNED_OFF', 'CLOSED', 'CANCELLED'];

/** Whether the work order as a whole is finished/closed and no longer workable. */
export function isWorkOrderClosed(status: WOStatus): boolean {
  return TERMINAL.includes(status);
}

/**
 * The signed-in assignee's own working status.
 *
 * A team work order is operated per person: each assignee starts, holds and
 * resumes their own work independently, tracked in `assigneeStates`. Completion
 * is tracked separately in `assigneeCompletions`, and takes precedence here.
 *
 * When there is no per-assignee record yet — a legacy WO, or a single-assignee
 * WO that predates per-assignee state — a lone assignee falls back to the
 * shared `status` so their view is unchanged; a member of a team with no record
 * is simply "not started" until they start their own work.
 */
export function resolveMyWorkStatus(
  wo: Pick<
    WorkOrder,
    'status' | 'assignedTechnicianIds' | 'assigneeStates' | 'assigneeCompletions'
  >,
  myId: string,
): MyWorkStatus {
  if (!myId) return 'NOT_STARTED';
  const completed = (wo.assigneeCompletions ?? []).some((c) => c.technicianId === myId);
  if (completed) return 'COMPLETED';

  const mine = (wo.assigneeStates ?? []).find((s) => s.technicianId === myId);
  if (mine) return mine.status;

  const isMultiAssignee = (wo.assignedTechnicianIds?.length ?? 0) > 1;
  if (!isMultiAssignee) {
    if (
      wo.status === 'IN_PROGRESS' ||
      wo.status === 'ON_HOLD_PARTS' ||
      wo.status === 'ON_HOLD_APPROVAL'
    ) {
      return wo.status;
    }
  }
  return 'NOT_STARTED';
}

/**
 * The shared WO status derived from everyone's per-assignee state — this is what
 * the supervisor and the work-order lists see.
 *
 * The moment anyone is actively working, the WO reads IN_PROGRESS; it only reads
 * on-hold when every still-active (not-yet-completed) assignee is on hold, so
 * one person pausing for parts never pauses the whole ticket. With no active
 * assignees left, the previous status is kept (finalisation handles COMPLETED).
 */
export function aggregateWoStatus(
  states: AssigneeWorkState[],
  completedIds: Set<string>,
  previous: WOStatus,
): WOStatus {
  const active = states.filter((s) => !completedIds.has(s.technicianId));
  if (active.length === 0) return previous;
  if (active.some((s) => s.status === 'IN_PROGRESS')) return 'IN_PROGRESS';
  if (active.every((s) => s.status === 'ON_HOLD_PARTS')) return 'ON_HOLD_PARTS';
  return 'ON_HOLD_APPROVAL';
}
