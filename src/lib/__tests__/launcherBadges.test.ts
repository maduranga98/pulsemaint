import { describe, it, expect } from 'vitest';
import { badgeLabel, launcherBadgeCounts, pathOnly, tileForLink, inSelectedPlant } from '../launcherBadges';

const TILES = [
  '/app/dashboard',
  '/app/breakdowns',
  '/app/work-orders',
  '/app/pm-schedules',
  '/app/requests',
  '/app/requests/inbox',
  '/app/training',
  '/app/training/my-modules',
  '/app/safety/cases',
  '/app/inventory/catalog',
  '/app/inventory/requests',
];

describe('launcher badges', () => {
  it('drops the query string and hash from a link', () => {
    expect(pathOnly('/app/work-orders?woId=abc')).toBe('/app/work-orders');
    expect(pathOnly('/app/breakdowns/#top')).toBe('/app/breakdowns');
  });

  it('maps a link to the module that contains it, preferring the most specific one', () => {
    expect(tileForLink('/app/breakdowns/BD-1', TILES)).toBe('/app/breakdowns');
    expect(tileForLink('/app/work-orders?woId=1', TILES)).toBe('/app/work-orders');
    expect(tileForLink('/app/requests/inbox', TILES)).toBe('/app/requests/inbox');
    expect(tileForLink('/app/requests', TILES)).toBe('/app/requests');
    expect(tileForLink('/app/training/my-modules', TILES)).toBe('/app/training/my-modules');
    expect(tileForLink('/app/training/manage/certificates', TILES)).toBe('/app/training');
    expect(tileForLink('/app/inventory/requests/r1', TILES)).toBe('/app/inventory/requests');
  });

  it('falls back to the first module under a parent link', () => {
    expect(tileForLink('/app/inventory', TILES)).toBe('/app/inventory/catalog');
  });

  it('ignores links outside every tile', () => {
    expect(tileForLink('/app/evaluations', TILES)).toBeNull();
  });

  it('counts per tile and skips entries without a usable link', () => {
    const counts = launcherBadgeCounts(
      [
        { linkTo: '/app/breakdowns/1' },
        { linkTo: '/app/breakdowns/2' },
        { linkTo: '/app/work-orders' },
        { linkTo: '/app/pm-schedules' },
        { linkTo: null },
        { linkTo: undefined },
        { linkTo: '/app/evaluations' },
      ],
      TILES,
    );
    expect(counts).toEqual({ '/app/breakdowns': 2, '/app/work-orders': 1, '/app/pm-schedules': 1 });
  });

  it('shows 9+ for big numbers', () => {
    expect(badgeLabel(3)).toBe('3');
    expect(badgeLabel(9)).toBe('9');
    expect(badgeLabel(10)).toBe('9+');
  });
});

describe('inSelectedPlant', () => {
  it('counts everything on All Plants', () => {
    expect(inSelectedPlant({ plantId: 'p1' }, null)).toBe(true);
    expect(inSelectedPlant({ plantId: null }, null)).toBe(true);
  });
  it('counts only the selected plant plus company-wide entries', () => {
    expect(inSelectedPlant({ plantId: 'p1' }, 'p1')).toBe(true);
    expect(inSelectedPlant({ plantId: 'p2' }, 'p1')).toBe(false);
    expect(inSelectedPlant({ plantId: null }, 'p1')).toBe(true);
    expect(inSelectedPlant({}, 'p1')).toBe(true);
  });
});
