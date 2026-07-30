import { describe, it, expect } from 'vitest';
import { buildTechnicianWorkLogs } from '../workorders/technicianWorkLogs';

const assignees = [
  { technicianId: 't-1', technicianName: 'Asitha', technicianRole: 'technician' },
  { technicianId: 't-2', technicianName: 'Wisal', technicianRole: 'trainee' },
];

const checklist = [
  { stepDescription: 'Isolate the drive', isCompleted: true, completedBy: 't-1', notes: 'LOTO applied' },
  { stepDescription: 'Check bearing temperature', isCompleted: true, completedBy: 't-1', measurementValue: 62, unit: '°C' },
  { stepDescription: 'Refit the guard', isCompleted: true, completedBy: 't-2', notes: null },
  { stepDescription: 'Final inspection', isCompleted: false, completedBy: null },
];

describe('buildTechnicianWorkLogs', () => {
  it('gives every assignee a log, even one who completed nothing', () => {
    const logs = buildTechnicianWorkLogs(assignees, [], {}, 2);
    expect(logs).toHaveLength(2);
    expect(logs.map((l) => l.technicianName)).toEqual(['Asitha', 'Wisal']);
  });

  it('carries each assignee’s role onto their log', () => {
    const [asitha, wisal] = buildTechnicianWorkLogs(assignees, [], {}, 2);
    expect(asitha.technicianRole).toBe('technician');
    expect(wisal.technicianRole).toBe('trainee');
  });

  it('lists only the steps that person completed', () => {
    const [asitha, wisal] = buildTechnicianWorkLogs(assignees, checklist, {}, 2);
    expect(asitha.tasksDescription).toContain('Isolate the drive');
    expect(asitha.tasksDescription).not.toContain('Refit the guard');
    expect(wisal.tasksDescription).toContain('Refit the guard');
    expect(wisal.tasksDescription).not.toContain('Isolate the drive');
  });

  it('excludes steps nobody completed', () => {
    const logs = buildTechnicianWorkLogs(assignees, checklist, {}, 2);
    for (const log of logs) {
      expect(log.tasksDescription).not.toContain('Final inspection');
    }
  });

  it('carries each step’s notes and measurement through', () => {
    const [asitha] = buildTechnicianWorkLogs(assignees, checklist, {}, 2);
    expect(asitha.tasksDescription).toContain('LOTO applied');
    expect(asitha.tasksDescription).toContain('62 °C');
  });

  it('attaches each person’s own work-done text only to their log', () => {
    const [asitha, wisal] = buildTechnicianWorkLogs(
      assignees,
      checklist,
      { 't-1': '  Replaced the coupling  ', 't-2': 'Reset the guard interlock' },
      2,
    );
    expect(asitha.tasksDescription).toContain('Work done: Replaced the coupling');
    expect(asitha.tasksDescription).not.toContain('Reset the guard interlock');
    expect(wisal.tasksDescription).toContain('Work done: Reset the guard interlock');
    expect(wisal.tasksDescription).not.toContain('Replaced the coupling');
  });

  it('omits the work-done line when that person wrote nothing', () => {
    const logs = buildTechnicianWorkLogs(assignees, checklist, { 't-1': '   ' }, 2);
    for (const log of logs) {
      expect(log.tasksDescription).not.toContain('Work done:');
    }
  });

  it('stamps the same computed hours on every log', () => {
    const logs = buildTechnicianWorkLogs(assignees, checklist, {}, 3.25);
    expect(logs.every((l) => l.hoursWorked === 3.25)).toBe(true);
  });

  it('does not attribute unassigned steps to an assignee with no id', () => {
    const logs = buildTechnicianWorkLogs(
      [{ technicianId: '', technicianName: 'Unknown' }],
      [{ stepDescription: 'Orphan step', isCompleted: true, completedBy: null }],
      {},
      1,
    );
    expect(logs[0].tasksDescription).toBe('');
  });
});
