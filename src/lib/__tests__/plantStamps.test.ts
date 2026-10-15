import { describe, it, expect } from 'vitest';
// @ts-expect-error -- CommonJS Cloud Functions module, no type declarations
import server from '../../../functions/src/machines/plantStamps.js';

describe('plant stamps', () => {
  it('stamps a record with a machine and no plant yet, or one moved to another machine', () => {
    expect(server.needsStamp(null, { machineId: 'm1' }, 'machinePlantId')).toBe(true);
    expect(server.needsStamp(null, { machineId: 'm1', machinePlantId: null }, 'machinePlantId')).toBe(false);
    expect(server.needsStamp({ machineId: 'm1', machinePlantId: 'p1' }, { machineId: 'm2', machinePlantId: 'p1' }, 'machinePlantId')).toBe(true);
    expect(server.needsStamp({ machineId: 'm1', machinePlantId: 'p1' }, { machineId: 'm1', machinePlantId: 'p1', status: 'X' }, 'machinePlantId')).toBe(false);
    expect(server.needsStamp(null, { name: 'no machine' }, 'machinePlantId')).toBe(false);
    expect(server.needsStamp(null, null, 'machinePlantId')).toBe(false);
  });

  it('knows which records are still open (they follow a machine to a new plant)', () => {
    const byName = new Map(server.PLANT_TARGETS.map((t: { collection: string }) => [t.collection, t]));
    const wo = byName.get('workOrders') as { isOpen: (d: object) => boolean; field: string };
    expect(wo.field).toBe('machinePlantId');
    expect(wo.isOpen({ status: 'IN_PROGRESS' })).toBe(true);
    expect(wo.isOpen({ status: 'CLOSED' })).toBe(false);
    const schedule = byName.get('pm_schedules') as { isOpen: (d: object) => boolean; field: string };
    expect(schedule.field).toBe('plantId');
    expect(schedule.isOpen({ status: 'active' })).toBe(true);
    expect(schedule.isOpen({ status: 'archived' })).toBe(false);
  });
});
