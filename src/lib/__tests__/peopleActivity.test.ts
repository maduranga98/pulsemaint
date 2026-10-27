import { describe, expect, it } from 'vitest';
import { buildPeopleActivity, TRAINING_ACTIVE_WINDOW_MS } from '../dashboard/peopleActivity';

const now = Date.parse('2026-10-27T10:00:00Z');
const ts = (ms: number) => ({ toMillis: () => ms });

describe('buildPeopleActivity', () => {
  it('lists in-progress work orders per assigned person', () => {
    const m = buildPeopleActivity({
      workOrders: [
        { status: 'IN_PROGRESS', woNumber: 'WO-1', machineName: 'Press', assignedTechnicianIds: ['a', 'b'] },
        { status: 'ASSIGNED', woNumber: 'WO-2', machineName: 'Lathe', assignedTechnicianIds: ['a'] },
      ],
      tickets: [],
      trainings: [],
    }, now);
    expect(m.get('a')).toEqual([{ kind: 'workOrder', label: 'WO-1 · Press' }]);
    expect(m.get('b')).toHaveLength(1);
  });

  it('counts breakdowns being attended (assigned or self-attended) once per person', () => {
    const m = buildPeopleActivity({
      workOrders: [],
      tickets: [
        { status: 'repair_in_progress', ticketNumber: 'BD-1', machineName: 'Oven', assignedTechnicianIds: ['a'], attendedBy: 'a' },
        { status: 'reported', ticketNumber: 'BD-2', machineName: 'Oven', assignedTechnicianIds: ['a'] },
      ],
      trainings: [],
    }, now);
    expect(m.get('a')).toEqual([{ kind: 'breakdown', label: 'BD-1 · Oven' }]);
  });

  it('shows a training only while it is in progress and recently active', () => {
    const m = buildPeopleActivity({
      workOrders: [],
      tickets: [],
      trainings: [
        { status: 'in_progress', traineeId: 'a', moduleName: 'LOTO', lastActivityAt: ts(now - 60_000) },
        { status: 'in_progress', traineeId: 'b', moduleName: 'LOTO', lastActivityAt: ts(now - TRAINING_ACTIVE_WINDOW_MS - 1) },
        { status: 'not_started', traineeId: 'c', moduleName: 'LOTO', lastActivityAt: ts(now) },
      ],
    }, now);
    expect(m.get('a')).toEqual([{ kind: 'training', label: 'LOTO' }]);
    expect(m.has('b')).toBe(false);
    expect(m.has('c')).toBe(false);
  });
});
