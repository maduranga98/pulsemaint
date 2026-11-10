import { describe, it, expect } from 'vitest';
import { packCircles } from '../packCircles';

describe('packCircles', () => {
  const items = [{ id: 'a', value: 42 }, { id: 'b', value: 27 }, { id: 'c', value: 18 }, { id: 'd', value: 13 }, { id: 'z', value: 0 }];
  const circles = packCircles(items, 420, 260);
  it('sizes by value, biggest first, and skips zero values', () => {
    expect(circles.map((c) => c.id)).toEqual(['a', 'b', 'c', 'd']);
    expect(circles[0].r).toBeGreaterThan(circles[1].r);
    expect(circles[1].r).toBeGreaterThan(circles[3].r);
  });
  it('keeps every circle inside the box and apart from the others', () => {
    circles.forEach((c) => {
      expect(c.x - c.r).toBeGreaterThanOrEqual(0);
      expect(c.x + c.r).toBeLessThanOrEqual(420);
      expect(c.y - c.r).toBeGreaterThanOrEqual(0);
      expect(c.y + c.r).toBeLessThanOrEqual(260);
    });
    for (let i = 0; i < circles.length; i++)
      for (let j = i + 1; j < circles.length; j++)
        expect(Math.hypot(circles[i].x - circles[j].x, circles[i].y - circles[j].y)).toBeGreaterThanOrEqual(circles[i].r + circles[j].r);
  });
  it('returns nothing for no data', () => {
    expect(packCircles([], 300, 200)).toEqual([]);
    expect(packCircles([{ id: 'x', value: 0 }], 300, 200)).toEqual([]);
  });
});
