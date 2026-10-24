import { describe, it, expect } from 'vitest';
import {
  canExtendWorkOrder,
  isAwaitingExtension,
  isExtendedClosed,
  isMergedExtension,
  buildExtensionRecord,
} from '../workOrderExtension';
import type { WOStatus } from '../../types/workOrder';

const base = { extensionOfWoId: null, activeExtensionWoId: null, mergedIntoWoId: null };

describe('canExtendWorkOrder', () => {
  it.each(['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'ON_HOLD_PARTS', 'ON_HOLD_APPROVAL', 'COMPLETED'] as WOStatus[])(
    'allows %s',
    (status) => expect(canExtendWorkOrder({ ...base, status })).toBe(true),
  );
  it.each(['DRAFT', 'SIGNED_OFF', 'CLOSED', 'CANCELLED'] as WOStatus[])('refuses %s', (status) =>
    expect(canExtendWorkOrder({ ...base, status })).toBe(false),
  );
  it('refuses an extension WO and a WO that already has an open extension', () => {
    expect(canExtendWorkOrder({ ...base, status: 'IN_PROGRESS', extensionOfWoId: 'a' })).toBe(false);
    expect(canExtendWorkOrder({ ...base, status: 'IN_PROGRESS', activeExtensionWoId: 'b' })).toBe(false);
  });
});

describe('flags', () => {
  it('detects an open extension, a merged extension and an extended closed WO', () => {
    expect(isAwaitingExtension({ activeExtensionWoId: 'x' })).toBe(true);
    expect(isAwaitingExtension({ activeExtensionWoId: null })).toBe(false);
    expect(isMergedExtension({ mergedIntoWoId: 'p' })).toBe(true);
    expect(isMergedExtension({})).toBe(false);
    expect(isExtendedClosed({ status: 'CLOSED', isExtended: true })).toBe(true);
    expect(isExtendedClosed({ status: 'IN_PROGRESS', isExtended: true })).toBe(false);
    expect(isExtendedClosed({ status: 'CLOSED', isExtended: false })).toBe(false);
  });
});

describe('buildExtensionRecord', () => {
  it('copies what the extension added and the sign-off details', () => {
    const rec = buildExtensionRecord(
      {
        id: 'e1',
        woNumber: 'WO-2',
        extensionReason: 'Needs a new seal',
        checklist: [{ stepNumber: 1, stepDescription: 'Fit seal' } as never],
        documents: [],
        workDoneDescription: 'Seal fitted',
        partsUsed: [],
        assignedTechnicianNames: ['Nimal'],
        actualStartTime: null,
        actualEndTime: null,
        totalDurationMinutes: 45,
      },
      { outcome: 'complete', outcomeReason: null, signedOffByName: 'Sup', signedOffAt: null },
    );
    expect(rec).toMatchObject({ woId: 'e1', woNumber: 'WO-2', reason: 'Needs a new seal', totalDurationMinutes: 45, outcome: 'complete' });
    expect(rec.checklist).toHaveLength(1);
  });
});
