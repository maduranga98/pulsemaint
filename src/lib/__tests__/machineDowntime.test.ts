import { describe, it, expect } from 'vitest';
import { computeDowntimeEvents } from '../machineDowntime';

const at = (iso: string) => new Date(iso);
const NOW = at('2026-10-15T12:00:00Z');

describe('computeDowntimeEvents', () => {
  it('measures a breakdown from report to supervisor sign-off', () => {
    const events = computeDowntimeEvents(
      [{ id: 'b1', machineId: 'm1', status: 'closed', reportedAt: at('2026-10-10T08:00:00Z'), machineStillRunning: false }],
      [{ id: 'w1', machineId: 'm1', linkedBreakdownId: 'b1', actualStartTime: at('2026-10-10T09:00:00Z'), supervisorSignOffAt: at('2026-10-10T14:30:00Z') }],
      NOW,
    );
    expect(events).toHaveLength(1);
    expect(events[0].kind).toBe('breakdown');
    expect(events[0].hours).toBeCloseTo(6.5);
  });

  it('keeps counting while the machine is still down', () => {
    const events = computeDowntimeEvents(
      [{ id: 'b1', machineId: 'm1', status: 'in_progress', reportedAt: at('2026-10-15T06:00:00Z') }],
      [{ id: 'w1', linkedBreakdownId: 'b1', actualStartTime: at('2026-10-15T07:00:00Z') }],
      NOW,
    );
    expect(events[0].ongoing).toBe(true);
    expect(events[0].hours).toBeCloseTo(6);
  });

  it('starts at repair start when the machine was still running', () => {
    const events = computeDowntimeEvents(
      [{ id: 'b1', machineId: 'm1', status: 'closed', reportedAt: at('2026-10-10T08:00:00Z'), machineStillRunning: true }],
      [{ id: 'w1', linkedBreakdownId: 'b1', actualStartTime: at('2026-10-10T10:00:00Z'), supervisorSignOffAt: at('2026-10-10T12:00:00Z') }],
      NOW,
    );
    expect(events[0].hours).toBeCloseTo(2);
  });

  it('measures other maintenance from start to sign-off, and does not double count breakdown WOs', () => {
    const events = computeDowntimeEvents(
      [{ id: 'b1', machineId: 'm1', status: 'closed', reportedAt: at('2026-10-10T08:00:00Z') }],
      [
        { id: 'w1', woType: 'BREAKDOWN', linkedBreakdownId: 'b1', actualStartTime: at('2026-10-10T09:00:00Z'), supervisorSignOffAt: at('2026-10-10T10:00:00Z') },
        { id: 'pm', woType: 'PREVENTIVE', machineId: 'm2', actualStartTime: at('2026-10-11T08:00:00Z'), supervisorSignOffAt: at('2026-10-11T11:00:00Z') },
      ],
      NOW,
    );
    expect(events.map((e) => e.kind).sort()).toEqual(['breakdown', 'maintenance']);
    expect(events.find((e) => e.kind === 'maintenance')!.hours).toBeCloseTo(3);
  });

  it('skips unsigned maintenance and falls back for legacy tickets', () => {
    const events = computeDowntimeEvents(
      [{ id: 'b1', status: 'closed', reportedAt: at('2026-10-01T08:00:00Z') }],
      [{ id: 'pm', actualStartTime: at('2026-10-11T08:00:00Z') }],
      NOW,
      () => 4,
    );
    expect(events).toHaveLength(1);
    expect(events[0].hours).toBe(4);
  });
});
