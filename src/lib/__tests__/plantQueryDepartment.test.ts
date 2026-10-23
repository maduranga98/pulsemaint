import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('firebase/firestore', () => ({
  where: (field: string, op: string, value: unknown) => ({ field, op, value }),
}));

import { useAuthStore } from '../../store/authStore';
import { plantConstraints, rulesDepartment } from '../plantQuery';

const profile = (role: string, extra: Record<string, unknown> = {}) =>
  ({ id: 'u1', role, plantId: 'P1', department: 'Stamping', ...extra }) as never;

describe('plantConstraints with department isolation (always on)', () => {
  beforeEach(() => useAuthStore.setState({ userProfile: null, company: null }));

  it('adds the department constraint to work orders and breakdown tickets for scoped roles', () => {
    for (const role of ['technician', 'trainee', 'supervisor', 'floor_operator']) {
      useAuthStore.setState({ userProfile: profile(role) });
      const dept = { field: 'machineDepartment', op: '==', value: 'Stamping' };
      expect(plantConstraints('workOrders'), role).toContainEqual(dept);
      expect(plantConstraints('breakdown_tickets'), role).toContainEqual(dept);
    }
  });

  it('keeps every other collection plant-only', () => {
    useAuthStore.setState({ userProfile: profile('technician') });
    expect(plantConstraints('machines')).toEqual([{ field: 'plantId', op: '==', value: 'P1' }]);
    expect(plantConstraints('pm_schedules')).toEqual([{ field: 'plantId', op: '==', value: 'P1' }]);
  });

  it('does not narrow plant-wide roles, admin, or users without a department', () => {
    for (const role of ['plant_manager', 'store_keeper', 'hr_officer', 'safety_officer']) {
      useAuthStore.setState({ userProfile: profile(role) });
      expect(rulesDepartment(), role).toBeNull();
    }
    useAuthStore.setState({ userProfile: profile('supervisor', { department: ' ' }) });
    expect(rulesDepartment()).toBeNull();
    useAuthStore.setState({ userProfile: profile('admin', { plantId: null, department: 'Stamping' }) });
    expect(rulesDepartment()).toBeNull();
    expect(plantConstraints('workOrders')).toEqual([]);
  });
});
