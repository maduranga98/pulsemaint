// Which breakdowns / work orders keep a machine "under maintenance". One
// definition, shared by the registry's live status (useMachinesWithOpenWork)
// and the auto-reactivation after close (machineOperationalStatus); the server
// copy is functions/src/machines/syncMachineStatus.js — change both together.

/** A breakdown is open work until it is resolved, closed or cancelled. */
const CLOSED_BREAKDOWN_STATUSES = new Set(['resolved', 'closed', 'cancelled']);

/**
 * A work order takes the machine out of service once its work has started and
 * keeps it there until sign-off. One that is only open / assigned (created but
 * not started, e.g. a PM raised ahead of its due date) doesn't.
 */
export const WORK_STARTED_WO_STATUSES = new Set([
  'IN_PROGRESS',
  'ON_HOLD_PARTS',
  'ON_HOLD_APPROVAL',
  'COMPLETED',
]);

export function isOpenBreakdownStatus(status: unknown): boolean {
  return !CLOSED_BREAKDOWN_STATUSES.has(String(status ?? ''));
}

export function isWoWorkStarted(status: unknown): boolean {
  return WORK_STARTED_WO_STATUSES.has(String(status ?? ''));
}
