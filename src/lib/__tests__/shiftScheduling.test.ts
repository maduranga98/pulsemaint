import { describe, expect, it } from 'vitest';
import {
  computeShiftTotals,
  getMyShiftPlans,
  isUserAssignedToShift,
  scheduledShiftMinutes,
} from '../../utils/handover.utils';
import type { ShiftConfig } from '../../types/handover.types';

function makeShift(overrides: Partial<ShiftConfig> = {}): ShiftConfig {
  return {
    id: 's1',
    companyId: 'c1',
    shiftName: 'Morning',
    startTime: '06:00',
    endTime: '14:00',
    color: '#fff',
    activeDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    department: null,
    status: 'active',
    memberIds: [],
    memberNames: [],
    roles: [],
    ...overrides,
  };
}

describe('scheduledShiftMinutes', () => {
  it('computes a normal day shift', () => {
    expect(scheduledShiftMinutes('06:00', '14:00')).toBe(480);
  });

  it('wraps overnight shifts past midnight', () => {
    expect(scheduledShiftMinutes('22:00', '06:00')).toBe(480);
    expect(scheduledShiftMinutes('20:30', '05:00')).toBe(510);
  });
});

describe('computeShiftTotals', () => {
  const shift = { startTime: '06:00', endTime: '14:00' };

  it('reports no OT when worked time is within the scheduled length', () => {
    const start = new Date('2026-07-16T06:00:00');
    const end = new Date('2026-07-16T13:30:00');
    const totals = computeShiftTotals(shift, start, end);
    expect(totals.totalMinutes).toBe(450);
    expect(totals.otMinutes).toBe(0);
    expect(totals.scheduledMinutes).toBe(480);
  });

  it('reports OT for time worked beyond the scheduled length', () => {
    const start = new Date('2026-07-16T06:00:00');
    const end = new Date('2026-07-16T16:15:00');
    const totals = computeShiftTotals(shift, start, end);
    expect(totals.totalMinutes).toBe(615);
    expect(totals.otMinutes).toBe(135);
  });

  it('handles overnight shifts', () => {
    const totals = computeShiftTotals(
      { startTime: '22:00', endTime: '06:00' },
      new Date('2026-07-16T22:00:00'),
      new Date('2026-07-17T07:00:00'),
    );
    expect(totals.totalMinutes).toBe(540);
    expect(totals.otMinutes).toBe(60);
  });
});

describe('isUserAssignedToShift / getMyShiftPlans', () => {
  it('matches by member list', () => {
    const shift = makeShift({ memberIds: ['u1'] });
    expect(isUserAssignedToShift(shift, { id: 'u1', role: 'technician' })).toBe(true);
    expect(isUserAssignedToShift(shift, { id: 'u2', role: 'technician' })).toBe(false);
  });

  it('matches by user shiftId assignment', () => {
    const shift = makeShift({ id: 'sX' });
    expect(isUserAssignedToShift(shift, { id: 'u1', role: 'technician', shiftId: 'sX' })).toBe(true);
    expect(isUserAssignedToShift(shift, { id: 'u1', role: 'technician', shiftId: 'other' })).toBe(false);
  });

  it('matches by scheduled role', () => {
    const shift = makeShift({ roles: ['technician'] });
    expect(isUserAssignedToShift(shift, { id: 'u9', role: 'technician' })).toBe(true);
    expect(isUserAssignedToShift(shift, { id: 'u9', role: 'hr_officer' })).toBe(false);
  });

  it('only returns active plans the user is scheduled on, most specific match first', () => {
    const shifts = [
      makeShift({ id: 'a', roles: ['technician'] }),
      makeShift({ id: 'b', roles: ['technician'], status: 'inactive' }),
      makeShift({ id: 'c', roles: ['supervisor'] }),
      makeShift({ id: 'd', memberIds: ['u1'] }),
    ];
    const plans = getMyShiftPlans(shifts, { id: 'u1', role: 'technician' });
    // 'd' matches by explicit member assignment (more specific) so it must
    // rank ahead of 'a', which only matches via the bulk role fallback.
    expect(plans.map((plan) => plan.id)).toEqual(['d', 'a']);
  });

  it('ranks an explicit member/shiftId match ahead of a role/department fallback that is also active', () => {
    const shifts = [
      makeShift({ id: 'roleMatch', roles: ['hr_officer'], startTime: '00:00', endTime: '23:59' }),
      makeShift({ id: 'assigned', memberIds: ['u1'], startTime: '00:00', endTime: '23:59' }),
    ];
    const plans = getMyShiftPlans(shifts, { id: 'u1', role: 'hr_officer' });
    expect(plans[0].id).toBe('assigned');
  });

  it('falls back to a department-wide plan when the user has no explicit assignment', () => {
    const shift = makeShift({ department: 'Machining' });
    expect(
      isUserAssignedToShift(shift, { id: 'u1', role: 'supervisor', department: 'Machining' }),
    ).toBe(true);
    expect(
      isUserAssignedToShift(shift, { id: 'u1', role: 'supervisor', department: 'Packaging' }),
    ).toBe(false);
  });

  it('does not use department fallback once the user has an explicit shiftId', () => {
    const shift = makeShift({ id: 'sX', department: 'Machining' });
    expect(
      isUserAssignedToShift(shift, {
        id: 'u1',
        role: 'supervisor',
        shiftId: 'other',
        department: 'Machining',
      }),
    ).toBe(false);
  });
});
