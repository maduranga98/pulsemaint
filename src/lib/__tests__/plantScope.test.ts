import { describe, it, expect } from 'vitest';
import { usersInPlant } from '../plantScope';

const users = [
  { id: 'a', plantId: 'p1' },
  { id: 'b', plantId: 'p2' },
  { id: 'c', plantId: null },
  { id: 'd' },
];

describe('usersInPlant', () => {
  it('keeps only the plant\'s own users — not other plants\', not unassigned ones', () => {
    expect(usersInPlant(users, 'p1').map((u) => u.id)).toEqual(['a']);
    expect(usersInPlant(users, 'p2').map((u) => u.id)).toEqual(['b']);
  });

  it('returns nobody for a plant that has no users', () => {
    expect(usersInPlant(users, 'p9')).toEqual([]);
  });

  it('returns everyone when the viewer is not plant-scoped (admin on All Plants)', () => {
    expect(usersInPlant(users, null)).toHaveLength(4);
  });
});
