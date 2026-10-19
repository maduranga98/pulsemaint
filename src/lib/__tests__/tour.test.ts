import { describe, it, expect } from 'vitest';
import { readTourOutcome, writeTourOutcome, clearTourOutcome, tourKey, type TourStorage } from '../../features/tour/tourState';
import { TOUR_DEFS, groupStepId, NAV_GROUP_TOUR_IDS } from '../../features/tour/tourDefs';
import enUS from '../../locales/en-US.json';

function memoryStorage(): TourStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v), removeItem: (k) => void data.delete(k) };
}

describe('tour state', () => {
  it('remembers completed and dismissed tours per user and tour', () => {
    const s = memoryStorage();
    expect(readTourOutcome('u1', 'main', s)).toBeNull();
    writeTourOutcome('u1', 'main', 'completed', s);
    writeTourOutcome('u2', 'main', 'dismissed', s);
    expect(readTourOutcome('u1', 'main', s)).toBe('completed');
    expect(readTourOutcome('u2', 'main', s)).toBe('dismissed');
    expect(readTourOutcome('u1', 'machine', s)).toBeNull();
    clearTourOutcome('u1', 'main', s);
    expect(readTourOutcome('u1', 'main', s)).toBeNull();
    expect(s.data.has(tourKey('u2', 'main'))).toBe(true);
  });
  it('ignores junk values and survives blocked storage', () => {
    const s = memoryStorage();
    s.setItem(tourKey('u1', 'main'), 'banana');
    expect(readTourOutcome('u1', 'main', s)).toBeNull();
    const broken: TourStorage = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); }, removeItem: () => { throw new Error('blocked'); } };
    expect(readTourOutcome('u1', 'main', broken)).toBeNull();
    expect(() => writeTourOutcome('u1', 'main', 'completed', broken)).not.toThrow();
    expect(() => clearTourOutcome('u1', 'main', broken)).not.toThrow();
    expect(readTourOutcome('u1', 'main', null)).toBeNull();
  });
});

describe('tour definitions', () => {
  it('every step has an id, a target, and text (keys or literal)', () => {
    for (const [tour, steps] of Object.entries(TOUR_DEFS)) {
      const ids = new Set<string>();
      for (const s of steps) {
        expect(ids.has(s.id), `${tour}.${s.id} duplicated`).toBe(false);
        ids.add(s.id);
        expect(s.target.length).toBeGreaterThan(0);
        expect(!!(s.titleKey && s.bodyKey) || !!(s.title && s.body), `${tour}.${s.id} has no text`).toBe(true);
      }
    }
  });
  it('the main tour has a step for every sidebar group', () => {
    const ids = TOUR_DEFS.main.map((s) => s.id);
    for (const g of NAV_GROUP_TOUR_IDS) expect(ids).toContain(groupStepId(g));
  });
});

describe('tour text', () => {
  const lookup = (key: string): unknown => key.split('.').reduce<unknown>((o, k) => (o && typeof o === 'object' ? (o as Record<string, unknown>)[k] : undefined), enUS);
  it('every locale key a tour step uses exists (English; the locale coverage test keeps the other languages in step)', () => {
    for (const [tour, steps] of Object.entries(TOUR_DEFS)) for (const s of steps) {
      for (const k of [s.titleKey, s.bodyKey]) if (k) expect(typeof lookup(k), `${tour}.${s.id}: ${k}`).toBe('string');
    }
  });
  it('has the button labels', () => {
    for (const k of ['next', 'back', 'done', 'skip', 'close', 'stepOf', 'nothingToShow', 'pageTour']) expect(typeof lookup(`tour.ui.${k}`)).toBe('string');
  });
});
