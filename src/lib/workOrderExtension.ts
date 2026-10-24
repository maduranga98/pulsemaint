import type { WorkOrder, WOExtensionRecord, WOStatus } from '../types/workOrder';

// A work order can be extended any time before it is signed off — while it is
// still being worked, on hold, or finished but waiting for sign-off (the root
// cause is written at sign-off, so "before RCA" means "before sign-off").
const EXTENDABLE: WOStatus[] = [
  'OPEN',
  'ASSIGNED',
  'IN_PROGRESS',
  'ON_HOLD_PARTS',
  'ON_HOLD_APPROVAL',
  'COMPLETED',
];

type ExtensionFields = Pick<
  WorkOrder,
  'status' | 'extensionOfWoId' | 'activeExtensionWoId' | 'mergedIntoWoId'
>;

/** True when a supervisor may raise an extension WO on this work order. */
export function canExtendWorkOrder(wo: ExtensionFields): boolean {
  return (
    EXTENDABLE.includes(wo.status) &&
    !wo.extensionOfWoId && // one level only — an extension is not extended again
    !wo.activeExtensionWoId // one extension at a time
  );
}

/** The WO can't be signed off while its extension is still being worked. */
export function isAwaitingExtension(wo: Pick<WorkOrder, 'activeExtensionWoId'>): boolean {
  return !!wo.activeExtensionWoId;
}

/** A signed-off extension that was folded into its parent — hidden from lists. */
export function isMergedExtension(wo: Pick<WorkOrder, 'mergedIntoWoId'>): boolean {
  return !!wo.mergedIntoWoId;
}

/** Closed work order that was extended — shown with the "Extended WO" status. */
export function isExtendedClosed(wo: Pick<WorkOrder, 'status' | 'isExtended'>): boolean {
  return !!wo.isExtended && (wo.status === 'CLOSED' || wo.status === 'SIGNED_OFF');
}

/** Snapshot of a signed-off extension WO, stored on the WO it extends. */
export function buildExtensionRecord(
  ext: Pick<
    WorkOrder,
    | 'id'
    | 'woNumber'
    | 'extensionReason'
    | 'checklist'
    | 'documents'
    | 'workDoneDescription'
    | 'partsUsed'
    | 'assignedTechnicianNames'
    | 'actualStartTime'
    | 'actualEndTime'
    | 'totalDurationMinutes'
  >,
  signOff: {
    outcome: WOExtensionRecord['outcome'];
    outcomeReason: string | null;
    signedOffByName: string;
    signedOffAt: WOExtensionRecord['signedOffAt'];
  },
): WOExtensionRecord {
  return {
    woId: ext.id,
    woNumber: ext.woNumber,
    reason: ext.extensionReason ?? '',
    checklist: ext.checklist ?? [],
    documents: ext.documents ?? [],
    workDoneDescription: ext.workDoneDescription ?? null,
    partsUsed: ext.partsUsed ?? [],
    assignedTechnicianNames: ext.assignedTechnicianNames ?? [],
    actualStartTime: ext.actualStartTime ?? null,
    actualEndTime: ext.actualEndTime ?? null,
    totalDurationMinutes: ext.totalDurationMinutes ?? null,
    outcome: signOff.outcome,
    outcomeReason: signOff.outcomeReason,
    signedOffByName: signOff.signedOffByName,
    signedOffAt: signOff.signedOffAt,
  };
}
