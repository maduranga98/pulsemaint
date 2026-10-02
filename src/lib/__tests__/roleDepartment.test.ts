import { describe, it, expect } from 'vitest';
import { departmentForRole, roleHasDepartment } from '../roleDepartment';
import type { UserRole } from '@/types/auth';

describe('roleHasDepartment', () => {
  it.each(['admin', 'plant_manager', 'store_keeper', 'hr_officer', 'safety_officer'] as UserRole[])(
    '%s has no department',
    (role) => expect(roleHasDepartment(role)).toBe(false),
  );

  it.each(['supervisor', 'technician', 'floor_operator', 'trainee'] as UserRole[])(
    '%s keeps its department',
    (role) => expect(roleHasDepartment(role)).toBe(true),
  );
});

describe('departmentForRole', () => {
  it('drops the department for roles without one, even if one was typed earlier', () => {
    expect(departmentForRole('safety_officer', 'Maintenance')).toBeNull();
    expect(departmentForRole('admin', 'Maintenance')).toBeNull();
  });

  it('trims and keeps it for the others, and turns blank into null', () => {
    expect(departmentForRole('technician', '  Packing ')).toBe('Packing');
    expect(departmentForRole('supervisor', '   ')).toBeNull();
    expect(departmentForRole('trainee', undefined)).toBeNull();
  });
});
