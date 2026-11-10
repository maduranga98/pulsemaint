import { describe, it, expect } from 'vitest';
import { gradientSpec, lighten, normalizeColor } from '../chartGradient';

describe('normalizeColor', () => {
  it('reads hex and rgb, and ignores anything else', () => {
    expect(normalizeColor('#1A56DB')).toBe('#1a56db');
    expect(normalizeColor('#abc')).toBe('#aabbcc');
    expect(normalizeColor('rgb(26, 86, 219)')).toBe('#1a56db');
    expect(normalizeColor('url(#x)')).toBeNull();
    expect(normalizeColor('var(--c)')).toBeNull();
    expect(normalizeColor('none')).toBeNull();
    expect(normalizeColor(null)).toBeNull();
  });
});

describe('gradientSpec', () => {
  it('lightens toward white', () => {
    expect(lighten('#000000', 0.5)).toBe('#808080');
    expect(lighten('#ffffff', 0.5)).toBe('#ffffff');
  });
  it('builds a vertical bar gradient, a horizontal one, and an area fade', () => {
    expect(gradientSpec('#1a56db', 'v')).toMatchObject({ id: 'fcg-v-1a56db', x2: '0', y2: '1' });
    expect(gradientSpec('#1a56db', 'h')).toMatchObject({ x2: '1', y2: '0' });
    const area = gradientSpec('#1a56db', 'area');
    expect(area.stops.map((s) => s.opacity)).toEqual([0.55, 0.03]);
    expect(area.stops.every((s) => s.color === '#1a56db')).toBe(true);
  });
});
