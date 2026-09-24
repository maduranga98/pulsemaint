import { describe, it, expect, vi } from 'vitest';

vi.mock('../firebase', () => ({ db: {} }));

import { effectiveMachineStatus } from '../../hooks/useMachinesWithOpenWork';

const open = (ids: string[], complete = true) => ({ openMachineIds: new Set(ids), complete });

describe('effectiveMachineStatus', () => {
  it('shows under maintenance while the machine has an open breakdown or work order', () => {
    expect(effectiveMachineStatus({ id: 'm1', status: 'active' }, open(['m1']))).toBe('under_maintenance');
  });

  it('shows active again once all of its work is closed / signed off', () => {
    expect(effectiveMachineStatus({ id: 'm1', status: 'under_maintenance' }, open([]))).toBe('active');
  });

  it('keeps the stored status when open work could not be fully checked', () => {
    expect(effectiveMachineStatus({ id: 'm1', status: 'under_maintenance' }, open([], false))).toBe('under_maintenance');
  });

  it('never changes a decommissioned machine', () => {
    expect(effectiveMachineStatus({ id: 'm1', status: 'decommissioned' }, open(['m1']))).toBe('decommissioned');
  });
});
