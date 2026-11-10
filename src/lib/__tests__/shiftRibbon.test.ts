import { describe, it, expect } from 'vitest';
import { layoutRibbon, toMinutes } from '../shiftRibbon';

const s = (id: string, start: string, end: string) => ({ id, name: id, start, end, color: '#00C2FF' });

describe('toMinutes', () => {
  it('reads HH:MM and rejects junk', () => {
    expect(toMinutes('06:30')).toBe(390);
    expect(toMinutes('24:00')).toBe(1440);
    expect(toMinutes('')).toBeNull();
    expect(toMinutes('25:00')).toBeNull();
    expect(toMinutes('ab')).toBeNull();
  });
});

describe('layoutRibbon', () => {
  it('puts back-to-back shifts on one lane', () => {
    const { segments, lanes } = layoutRibbon([s('a', '06:00', '14:00'), s('b', '14:00', '22:00')]);
    expect(lanes).toBe(1);
    expect(segments.map((x) => [x.from, x.to, x.lane])).toEqual([[360, 840, 0], [840, 1320, 0]]);
  });
  it('splits a night shift at midnight', () => {
    const { segments } = layoutRibbon([s('n', '22:00', '06:00')]);
    expect(segments.map((x) => [x.from, x.to])).toEqual([[0, 360], [1320, 1440]]);
  });
  it('stacks overlapping shifts on separate lanes', () => {
    const { segments, lanes } = layoutRibbon([s('a', '06:00', '14:00'), s('b', '08:00', '16:00'), s('c', '14:00', '20:00')]);
    expect(lanes).toBe(2);
    expect(segments.find((x) => x.shiftId === 'b')?.lane).toBe(1);
    expect(segments.find((x) => x.shiftId === 'c')?.lane).toBe(0);
  });
  it('skips shifts with no usable time or zero length', () => {
    expect(layoutRibbon([s('x', '', '10:00'), s('y', '08:00', '08:00')]).segments).toEqual([]);
  });
});
