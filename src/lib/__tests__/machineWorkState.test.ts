import { describe, it, expect } from 'vitest';
import { isOpenBreakdownStatus, isWoWorkStarted } from '../machineWorkState';

describe('machineWorkState', () => {
  it('a breakdown is open until resolved / closed / cancelled', () => {
    for (const s of ['reported', 'assigned', 'repair_in_progress', 'on_hold_parts']) expect(isOpenBreakdownStatus(s)).toBe(true);
    for (const s of ['resolved', 'closed', 'cancelled']) expect(isOpenBreakdownStatus(s)).toBe(false);
  });
  it('a work order only takes the machine down once started, until sign-off', () => {
    for (const s of ['IN_PROGRESS', 'ON_HOLD_PARTS', 'ON_HOLD_APPROVAL', 'COMPLETED']) expect(isWoWorkStarted(s)).toBe(true);
    for (const s of ['DRAFT', 'OPEN', 'ASSIGNED', 'SIGNED_OFF', 'CLOSED', 'CANCELLED', undefined]) expect(isWoWorkStarted(s)).toBe(false);
  });
});
