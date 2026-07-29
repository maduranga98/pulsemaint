import { describe, it, expect } from 'vitest';
import { buildTechnicianWorkLogs } from '../workorders/technicianWorkLogs';

const assignees = [
  { technicianId: 't-1', technicianName: 'Asitha' },
  { technicianId: 't-2', technicianName: 'Wisal' },
];

const checklist = [
  { stepDescription: 'Isolate the drive', isCompleted: true, completedBy: 't-1', notes: 'LOTO applied' },
  { stepDescription: 'Check bearing temperature', isCompleted: true, completedBy: 't-1', measurementValue: 62, unit: '°C' },
  { stepDescription: 'Refit the guard', isCompleted: true, completedBy: 't-2', notes: null },
  { stepDescription: 'Final inspection', isCompleted: false, completedBy: null },
];

describe('buildTechnicianWorkLogs', () => {
  it('gives every assignee a log, even one who completed nothing', () => {
    const logs = buildTechnicianWorkLogs(assignees, [], '', 2);
    expect(logs).toHaveLength(2);
    expect(logs.map((l) => l.technicianName)).toEqual(['Asitha', 'Wisal']);
  });

  it('lists only the steps that person completed', () => {
    const [asitha, wisal] = buildTechnicianWorkLogs(assignees, checklist, '', 2);
    expect(asitha.tasksDescription).toContain('Isolate the drive');
    expect(asitha.tasksDescription).not.toContain('Refit the guard');
    expect(wisal.tasksDescription).toContain('Refit the guard');
    expect(wisal.tasksDescription).not.toContain('Isolate the drive');
  });

  it('excludes steps nobody completed', () => {
    const logs = buildTechnicianWorkLogs(assignees, checklist, '', 2);
    for (const log of logs) {
      expect(log.tasksDescription).not.toContain('Final inspection');
    }
  });

  it('carries each step’s notes and measurement through', () => {
    const [asitha] = buildTechnicianWorkLogs(assignees, checklist, '', 2);
    expect(asitha.tasksDescription).toContain('LOTO applied');
    expect(asitha.tasksDescription).toContain('62 °C');
  });

  it('appends the work-done description to every log', () => {
    const logs = buildTechnicianWorkLogs(assignees, checklist, '  Replaced the coupling  ', 2);
    for (const log of logs) {
      expect(log.tasksDescription).toContain('Work done: Replaced the coupling');
    }
  });

  it('omits the work-done line when nothing was written', () => {
    const logs = buildTechnicianWorkLogs(assignees, checklist, '   ', 2);
    for (const log of logs) {
      expect(log.tasksDescription).not.toContain('Work done:');
    }
  });

  it('stamps the same computed hours on every log', () => {
    const logs = buildTechnicianWorkLogs(assignees, checklist, '', 3.25);
    expect(logs.every((l) => l.hoursWorked === 3.25)).toBe(true);
  });

  it('does not attribute unassigned steps to an assignee with no id', () => {
    const logs = buildTechnicianWorkLogs(
      [{ technicianId: '', technicianName: 'Unknown' }],
      [{ stepDescription: 'Orphan step', isCompleted: true, completedBy: null }],
      '',
      1,
    );
    expect(logs[0].tasksDescription).toBe('');
  });
});
