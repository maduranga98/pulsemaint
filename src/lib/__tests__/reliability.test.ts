import { describe, it, expect } from 'vitest';
import { computeWrenchTimePercent, getBadActors, computePMComplianceStatus } from '../reliabilityUtils';
import type { TimeSegment } from '../../types/workOrder';

function makeTimestamp(ms: number) {
  return { toMillis: () => ms } as any;
}

function makeSeg(state: TimeSegment['state'], startMs: number, endMs: number | null): TimeSegment {
  return {
    state,
    startAt: makeTimestamp(startMs),
    endAt: endMs !== null ? makeTimestamp(endMs) : null,
    note: null,
  };
}

describe('computeWrenchTimePercent', () => {
  it('returns 0 for empty segments', () => {
    expect(computeWrenchTimePercent([])).toBe(0);
  });

  it('returns 0 when all segments have no endAt', () => {
    const segs = [makeSeg('working', 0, null)];
    expect(computeWrenchTimePercent(segs)).toBe(0);
  });

  it('returns 100 when all time is working', () => {
    const segs = [makeSeg('working', 0, 3600000)];
    expect(computeWrenchTimePercent(segs)).toBe(100);
  });

  it('returns 50 for equal working and travel time', () => {
    const segs = [
      makeSeg('working', 0, 1000),
      makeSeg('travel', 1000, 2000),
    ];
    expect(computeWrenchTimePercent(segs)).toBe(50);
  });

  it('ignores open segments in calculation', () => {
    const segs = [
      makeSeg('working', 0, 1000),
      makeSeg('waiting-parts', 1000, null),
    ];
    expect(computeWrenchTimePercent(segs)).toBe(100);
  });

  it('correctly computes multi-segment wrench time', () => {
    const segs = [
      makeSeg('working', 0, 2000),
      makeSeg('travel', 2000, 4000),
      makeSeg('waiting-permit', 4000, 5000),
    ];
    // 2000ms working out of 5000ms total = 40%
    expect(computeWrenchTimePercent(segs)).toBe(40);
  });
});

describe('getBadActors', () => {
  it('returns top 20% of machines by breakdown count', () => {
    const counts = { m1: 10, m2: 8, m3: 5, m4: 3, m5: 1 };
    const result = getBadActors(counts, 5);
    // 20% of 5 = 1 (ceil), so top 1
    expect(result).toHaveLength(1);
    expect(result[0]).toBe('m1');
  });

  it('returns at least 1 bad actor', () => {
    const counts = { m1: 2 };
    const result = getBadActors(counts, 1);
    expect(result).toHaveLength(1);
  });

  it('returns machines in descending breakdown count order', () => {
    const counts = { m1: 3, m2: 10, m3: 7 };
    const result = getBadActors(counts, 10);
    expect(result[0]).toBe('m2');
  });

  it('returns empty array for empty counts', () => {
    const result = getBadActors({}, 5);
    expect(result).toHaveLength(0);
  });
});

describe('computePMComplianceStatus', () => {
  it('returns good for rate >= 80', () => {
    expect(computePMComplianceStatus(80)).toBe('good');
    expect(computePMComplianceStatus(100)).toBe('good');
  });

  it('returns warning for rate between 60 and 79', () => {
    expect(computePMComplianceStatus(60)).toBe('warning');
    expect(computePMComplianceStatus(79)).toBe('warning');
  });

  it('returns poor for rate below 60', () => {
    expect(computePMComplianceStatus(59)).toBe('poor');
    expect(computePMComplianceStatus(0)).toBe('poor');
  });
});
