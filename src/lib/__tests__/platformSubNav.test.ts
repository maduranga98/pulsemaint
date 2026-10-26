import { describe, it, expect } from 'vitest';
import { subNavFor, leadsViewFrom, featureTabFrom, todoTabFrom } from '../platform/subNav';

describe('platform phone dock sub-views', () => {
  it('leads: URL wins, then the stored view, then the board', () => {
    expect(leadsViewFrom('?view=list', 'insights')).toBe('list');
    expect(leadsViewFrom('', 'insights')).toBe('insights');
    expect(leadsViewFrom('?view=nope', 'bogus')).toBe('board');
  });
  it('feature requests show Features and Bugs only', () => {
    const r = subNavFor('/platform/feature-requests', '?tab=bug');
    expect(r.items.map((i) => i.id)).toEqual(['feature', 'bug']);
    expect(r.activeId).toBe('bug');
    expect(featureTabFrom('')).toBe('feature');
  });
  it('to-do shows Open and Done', () => {
    expect(subNavFor('/platform/todos', '?tab=done').activeId).toBe('done');
    expect(todoTabFrom('')).toBe('open');
  });
  it('leads show board, list, insights, trials', () => {
    expect(subNavFor('/platform/leads/', '').items.map((i) => i.id)).toEqual(['board', 'list', 'insights', 'trials']);
  });
  it('pages without sub-views have none (home only)', () => {
    expect(subNavFor('/platform/calls', '').items).toEqual([]);
    expect(subNavFor('/platform/plans', '').activeId).toBeNull();
  });
});
