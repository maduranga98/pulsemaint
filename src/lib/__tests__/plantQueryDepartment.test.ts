import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('firebase/firestore', () => ({
  where: (field: string, op: string, value: unknown) => ({ field, op, value }),
}));

import { useAuthStore } from '../../store/authStore';
import { plantConstraints, rulesDepartment } from '../plantQuery';

const profile = (role: string, extra: Record<string, unknown> = {}) =>
  ({ id: 'u1', role, plantId: 'P1', department: 'Stamping', ...extra }) as never;
const company = (departmentIsolation?: boolean) => ({ id: 'A', departmentIsolation }) as never;

describe('plantConstraints with department isolation', () => {
  beforeEach(() => useAuthStore.setState({ userProfile: null, company: null }));

  it('adds only the plant constraint while the company switch is off', () => {
    useAuthStore.setState({ userProfile: profile('supervisor'), company: company(false) });
    expect(plantConstraints('workOrders')).toEqual([{ field: 'machinePlantId', op: '==', value: 'P1' }]);
    expect(rulesDepartment()).toBeNull();
  });

  it('adds the department constraint to work orders and breakdown tickets when on', () => {
    useAuthStore.setState({ userProfile: profile('technician'), company: company(true) });
    const dept = { field: 'machineDepartment', op: '==', value: 'Stamping' };
    expect(plantConstraints('workOrders')).toContainEqual(dept);
    expect(plantConstraints('breakdown_tickets')).toContainEqual(dept);
    // Other collections stay plant-only.
    expect(plantConstraints('machines')).toEqual([{ field: 'plantId', op: '==', value: 'P1' }]);
  });

  it('does not narrow roles that are not department-scoped, or users without a department', () => {
    useAuthStore.setState({ userProfile: profile('plant_manager'), company: company(true) });
    expect(rulesDepartment()).toBeNull();
    useAuthStore.setState({ userProfile: profile('supervisor', { department: ' ' }), company: company(true) });
    expect(rulesDepartment()).toBeNull();
    useAuthStore.setState({ userProfile: profile('admin', { plantId: null }), company: company(true) });
    expect(plantConstraints('workOrders')).toEqual([]);
  });
});
