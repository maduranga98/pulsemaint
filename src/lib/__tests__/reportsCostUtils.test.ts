import { describe, it, expect } from 'vitest';
import { topHealthScores, computeWoTotalCost, totalCostByWoType } from '../reportsCostUtils';

describe('topHealthScores', () => {
  it('returns top N rows sorted by health score descending', () => {
    const rows = [
      { machineName: 'A', healthScore: 60 },
      { machineName: 'B', healthScore: 95 },
      { machineName: 'C', healthScore: 80 },
      { machineName: 'D', healthScore: 40 },
      { machineName: 'E', healthScore: 75 },
      { machineName: 'F', healthScore: 99 },
    ];
    expect(topHealthScores(rows, 5)).toEqual([
      { label: 'F', value: 99 },
      { label: 'B', value: 95 },
      { label: 'C', value: 80 },
      { label: 'E', value: 75 },
      { label: 'A', value: 60 },
    ]);
  });

  it('does not mutate the input array', () => {
    const rows = [
      { machineName: 'A', healthScore: 10 },
      { machineName: 'B', healthScore: 50 },
    ];
    const original = [...rows];
    topHealthScores(rows, 5);
    expect(rows).toEqual(original);
  });

  it('handles fewer rows than count', () => {
    const rows = [{ machineName: 'A', healthScore: 10 }];
    expect(topHealthScores(rows, 5)).toEqual([{ label: 'A', value: 10 }]);
  });
});

describe('computeWoTotalCost', () => {
  it('sums parts + labor for a non-contractor WO', () => {
    expect(computeWoTotalCost(150, 50, 0)).toBe(200);
  });

  it('includes contractor total project cost for a contractor WO', () => {
    expect(computeWoTotalCost(150, 0, 5000)).toBe(5150);
  });

  it('treats missing values as zero', () => {
    expect(computeWoTotalCost(0, 0, 0)).toBe(0);
  });
});

describe('totalCostByWoType', () => {
  it('sums total cost grouped by WO type, descending', () => {
    const rows = [
      { woType: 'corrective', totalCost: 100 },
      { woType: 'preventive', totalCost: 50 },
      { woType: 'corrective', totalCost: 300 },
    ];
    expect(totalCostByWoType(rows)).toEqual([
      { label: 'corrective', value: 400 },
      { label: 'preventive', value: 50 },
    ]);
  });

  it('groups missing WO type under Unknown', () => {
    const rows = [{ woType: undefined, totalCost: 10 }];
    expect(totalCostByWoType(rows)).toEqual([{ label: 'Unknown', value: 10 }]);
  });
});
