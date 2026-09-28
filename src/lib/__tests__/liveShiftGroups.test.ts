import { describe, it, expect } from 'vitest';
import { groupWorkingByDepartment, type LiveRow } from '../liveShiftGroups';

const m = (id: string, department: string | null, plantId: string | null, status = 'working') => ({
  id, name: id, role: 'technician', status, workingSince: new Date(2026, 8, 26, 8), department, plantId,
});

const rows: LiveRow[] = [
  { shift: { id: 's1', shiftName: 'Morning', plantId: null }, members: [
    m('ann', 'Manufacturing', 'ny'), m('bo', 'manufacturing ', 'wa'), m('cy', null, 'ny'), m('di', 'Stores', null), m('ed', 'Stores', 'ny', 'not_working'),
  ] },
  { shift: { id: 's2', shiftName: 'Afternoon', plantId: 'wa' }, members: [m('ann', 'Manufacturing', 'ny'), m('fay', 'Paint', null)] },
];

describe('groupWorkingByDepartment', () => {
  it('groups everyone working by department, no-department last, each person once', () => {
    const g = groupWorkingByDepartment(rows, null);
    expect(g.map((x) => x.department)).toEqual(['Manufacturing', 'Paint', 'Stores', null]);
    expect(g[0].people.map((p) => p.id)).toEqual(['ann', 'bo']);
    expect(g.flatMap((x) => x.people).filter((p) => p.id === 'ann')).toHaveLength(1);
    expect(g.flatMap((x) => x.people).some((p) => p.id === 'ed')).toBe(false);
  });

  it('filters by the person\'s plant, falling back to the shift plan\'s', () => {
    const ny = groupWorkingByDepartment(rows, 'ny');
    expect(ny.flatMap((x) => x.people).map((p) => p.id).sort()).toEqual(['ann', 'cy', 'di']);
    const wa = groupWorkingByDepartment(rows, 'wa');
    // fay has no plant of her own → the Afternoon plan's plant (wa).
    expect(wa.flatMap((x) => x.people).map((p) => p.id).sort()).toEqual(['bo', 'di', 'fay']);
  });
});
