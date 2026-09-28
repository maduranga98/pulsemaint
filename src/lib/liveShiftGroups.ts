/**
 * Live Shift Status, grouped by department instead of by shift plan: every
 * person currently clocked in (once, even if more than one plan covers them),
 * filtered to the selected plant by the person's own plant — falling back to
 * the shift plan's plant, and kept when neither is set (same convention as
 * usePlantUserIds) — then bucketed by department. People with no department
 * go last, in a "no department" group (department: null).
 */

export interface LiveMember {
  id: string;
  name: string;
  role: string | null;
  status: string;
  workingSince: Date | null;
  department: string | null;
  plantId: string | null;
}

export interface LiveRow {
  shift: { id: string; shiftName: string; plantId?: string | null; color?: string | null };
  members: LiveMember[];
}

export interface WorkingPerson extends LiveMember {
  shiftName: string;
  shiftColor: string | null;
}

export interface DepartmentGroup {
  /** Display name (first spelling seen); null = no department. */
  department: string | null;
  people: WorkingPerson[];
}

const norm = (v: string | null | undefined) => (v ?? '').trim().replace(/\s+/g, ' ').toLowerCase();

export function groupWorkingByDepartment(rows: LiveRow[], plantId: string | null): DepartmentGroup[] {
  const seen = new Set<string>();
  const people: WorkingPerson[] = [];
  for (const row of rows) {
    for (const m of row.members) {
      if (m.status !== 'working' || seen.has(m.id)) continue;
      const plant = m.plantId ?? row.shift.plantId ?? null;
      if (plantId && plant && plant !== plantId) continue;
      seen.add(m.id);
      people.push({ ...m, shiftName: row.shift.shiftName, shiftColor: row.shift.color ?? null });
    }
  }

  const groups = new Map<string, DepartmentGroup>();
  for (const p of people) {
    const key = norm(p.department);
    if (!groups.has(key)) groups.set(key, { department: key ? p.department!.trim() : null, people: [] });
    groups.get(key)!.people.push(p);
  }
  const bySince = (a: WorkingPerson, b: WorkingPerson) =>
    (a.workingSince?.getTime() ?? 0) - (b.workingSince?.getTime() ?? 0) || a.name.localeCompare(b.name);
  return [...groups.values()]
    .map((g) => ({ ...g, people: g.people.sort(bySince) }))
    .sort((a, b) => {
      if (a.department === null) return 1;
      if (b.department === null) return -1;
      return a.department.localeCompare(b.department);
    });
}
