import { describe, it, expect } from 'vitest';
import { isPickableBreakdown, isPickableWorkOrder } from '../recordReferences';

const DAY = 24 * 60 * 60 * 1000;
const now = Date.UTC(2026, 8, 26);
const ago = (days: number) => ({ toMillis: () => now - days * DAY });

describe('isPickableWorkOrder', () => {
  it('allows signed-off / closed WOs finished 30+ days ago', () => {
    expect(isPickableWorkOrder({ status: 'SIGNED_OFF', supervisorSignOffAt: ago(31) }, now)).toBe(true);
    expect(isPickableWorkOrder({ status: 'CLOSED', closedAt: ago(30) }, now)).toBe(true);
  });
  it('rejects recent or unfinished WOs', () => {
    expect(isPickableWorkOrder({ status: 'SIGNED_OFF', supervisorSignOffAt: ago(29) }, now)).toBe(false);
    expect(isPickableWorkOrder({ status: 'COMPLETED', updatedAt: ago(90) }, now)).toBe(false);
    expect(isPickableWorkOrder({ status: 'IN_PROGRESS', updatedAt: ago(90) }, now)).toBe(false);
  });
  it('uses the sign-off date over the last update', () => {
    expect(isPickableWorkOrder({ status: 'SIGNED_OFF', supervisorSignOffAt: ago(5), updatedAt: ago(60) }, now)).toBe(false);
  });
  it('rejects a finished WO with no finish date', () => {
    expect(isPickableWorkOrder({ status: 'CLOSED' }, now)).toBe(false);
  });
});

describe('isPickableBreakdown', () => {
  it('allows breakdowns closed 30+ days ago', () => {
    expect(isPickableBreakdown({ status: 'closed', closedAt: ago(45) }, now)).toBe(true);
    expect(isPickableBreakdown({ status: 'closed', resolvedAt: ago(40) }, now)).toBe(true);
  });
  it('rejects recent or open breakdowns', () => {
    expect(isPickableBreakdown({ status: 'closed', closedAt: ago(10) }, now)).toBe(false);
    expect(isPickableBreakdown({ status: 'resolved', resolvedAt: ago(60) }, now)).toBe(false);
  });
});
