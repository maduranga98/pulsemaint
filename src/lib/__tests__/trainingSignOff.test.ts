import { describe, it, expect } from 'vitest';
import { canSignOffTraining } from '../training/trainingSignOff';

const assignment = { assignedBy: 'pm-1' };

describe('canSignOffTraining', () => {
  it('lets a supervisor sign off', () => {
    expect(canSignOffTraining(assignment, 'supervisor', 'sup-1').allowed).toBe(true);
  });

  it('lets an admin sign off, even one they assigned themselves', () => {
    expect(canSignOffTraining({ assignedBy: 'admin-1' }, 'admin', 'admin-1').allowed).toBe(true);
  });

  it('lets a plant manager sign off training someone else assigned', () => {
    expect(canSignOffTraining(assignment, 'plant_manager', 'pm-2').allowed).toBe(true);
  });

  it('blocks a plant manager from signing off training they assigned', () => {
    const result = canSignOffTraining(assignment, 'plant_manager', 'pm-1');
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/assigned this training/i);
  });

  it('blocks roles that cannot sign off at all', () => {
    for (const role of ['technician', 'trainee', 'store_keeper', 'hr_officer', 'floor_operator'] as const) {
      expect(canSignOffTraining(assignment, role, 'u-1').allowed).toBe(false);
    }
    expect(canSignOffTraining(assignment, undefined, undefined).allowed).toBe(false);
  });
});
