import { describe, expect, it } from 'vitest';
import {
  breakdownJob, durationMinutes, findConflicts, newBreakdownSlot, newWorkOrderSlot, slotsOverlap, workOrderJob,
} from '../assignmentSlots';

const H = 3_600_000;
const NOW = Date.UTC(2026, 9, 23, 8, 0, 0);
const at = (hours: number) => ({ toMillis: () => NOW + hours * H });

describe('slots', () => {
  it('converts durations, defaulting to 4 hours', () => {
    expect(durationMinutes(2, 'hours')).toBe(120);
    expect(durationMinutes(30, 'minutes')).toBe(30);
    expect(durationMinutes(1, 'days')).toBe(1440);
    expect(durationMinutes(0, 'hours')).toBe(240);
    expect(durationMinutes(undefined, undefined)).toBe(240);
  });

  it('touching slots do not overlap, crossing ones do', () => {
    expect(slotsOverlap({ startMs: 0, endMs: 10 }, { startMs: 10, endMs: 20 })).toBe(false);
    expect(slotsOverlap({ startMs: 0, endMs: 11 }, { startMs: 10, endMs: 20 })).toBe(true);
  });

  it('a new WO starts at its scheduled time, or now', () => {
    expect(newWorkOrderSlot(at(2), 3, 'hours', NOW)).toEqual({ startMs: NOW + 2 * H, endMs: NOW + 5 * H });
    expect(newWorkOrderSlot(null, 1, 'hours', NOW)).toEqual({ startMs: NOW, endMs: NOW + H });
  });
});

describe('who is already assigned when', () => {
  const wo = (over: Record<string, unknown>) => ({ id: 'w1', woNumber: 'WO-1', status: 'ASSIGNED', assignedTechnicianIds: ['t1'], scheduledStart: at(1), estimatedDuration: 2, estimatedDurationUnit: 'hours', ...over });

  it('a person with another WO at a different time can still be assigned', () => {
    const jobs = [workOrderJob(wo({}), NOW)!]; // 09:00–11:00
    const c = findConflicts(newWorkOrderSlot(at(4), 2, 'hours', NOW), jobs); // 12:00–14:00
    expect(c.has('t1')).toBe(false);
  });

  it('overlapping times show the person as already assigned, with the work order', () => {
    const jobs = [workOrderJob(wo({}), NOW)!];
    const c = findConflicts(newWorkOrderSlot(at(2), 2, 'hours', NOW), jobs); // 10:00–12:00 crosses 09:00–11:00
    expect(c.get('t1')?.job.ref).toBe('WO-1');
  });

  it('an unscheduled open WO claims no time; a started one does', () => {
    expect(workOrderJob(wo({ scheduledStart: null }), NOW)).toBeNull();
    const started = workOrderJob(wo({ status: 'IN_PROGRESS', scheduledStart: null, actualStartTime: at(-1) }), NOW)!;
    expect(started.slot.startMs).toBe(NOW - H);
    expect(started.slot.endMs).toBeGreaterThan(NOW); // still occupies the person now
  });

  it('closed and cancelled work, and people who already finished their part, do not count', () => {
    expect(workOrderJob(wo({ status: 'CLOSED' }), NOW)).toBeNull();
    expect(workOrderJob(wo({ assigneeCompletions: [{ technicianId: 't1' }] }), NOW)!.technicianIds).toEqual([]);
  });

  it('a breakdown holds its attender and assignees; one with a WO is held by the WO instead', () => {
    const b = { id: 'b1', ticketNumber: 'BD-9', status: 'repair_in_progress', attendedBy: 't2', assignedTechnicianIds: ['t3'], attendedAt: at(-0.5) };
    const job = breakdownJob(b, NOW)!;
    expect(job.technicianIds.sort()).toEqual(['t2', 't3']);
    const c = findConflicts(newBreakdownSlot(NOW), [job]);
    expect(c.get('t2')?.job.ref).toBe('BD-9');
    expect(breakdownJob({ ...b, linkedWOId: 'w9' }, NOW)).toBeNull();
    expect(breakdownJob({ ...b, status: 'resolved' }, NOW)).toBeNull();
  });

  it('the breakdown a WO is being raised for is ignored', () => {
    const job = breakdownJob({ id: 'b1', ticketNumber: 'BD-9', status: 'assigned', assignedTechnicianIds: ['t2'], assignedAt: at(0) }, NOW)!;
    expect(findConflicts(newWorkOrderSlot(null, 1, 'hours', NOW), [job], new Set(['b1'])).size).toBe(0);
  });
});
