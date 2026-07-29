import { describe, it, expect } from 'vitest';
import {
  topHealthScores,
  computeWoTotalCost,
  totalCostByWoType,
  computeStockStatusBuckets,
  downtimeByWeekday,
  lateByBuckets,
  lateVsOnTimeCounts,
  flattenPoLineItems,
  topByTotalMarks,
} from '../reportsCostUtils';

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

describe('computeStockStatusBuckets', () => {
  it('buckets parts into In Stock / Low Stock / Out of Stock', () => {
    const parts = [
      { currentStock: 50, isLowStock: false },
      { currentStock: 2, isLowStock: true },
      { currentStock: 0, isLowStock: true },
      { currentStock: -1, isLowStock: false },
    ];
    expect(computeStockStatusBuckets(parts)).toEqual([
      { label: 'In Stock', value: 1 },
      { label: 'Low Stock', value: 1 },
      { label: 'Out of Stock', value: 2 },
    ]);
  });

  it('treats zero-or-below stock as Out of Stock even when isLowStock is not set', () => {
    expect(computeStockStatusBuckets([{ currentStock: 0 }])).toEqual([
      { label: 'In Stock', value: 0 },
      { label: 'Low Stock', value: 0 },
      { label: 'Out of Stock', value: 1 },
    ]);
  });
});

describe('downtimeByWeekday', () => {
  it('sums downtime minutes per weekday, Mon..Sun', () => {
    // 2026-07-27 is a Monday.
    const monday = new Date('2026-07-27T08:00:00Z');
    const tuesday = new Date('2026-07-28T08:00:00Z');
    const rows = [
      { createdAt: monday, downtimeMinutes: 60 },
      { createdAt: monday, downtimeMinutes: 30 },
      { createdAt: tuesday, downtimeMinutes: 15 },
    ];
    const result = downtimeByWeekday(rows);
    expect(result.map((r) => r.label)).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
    expect(result[0]).toEqual({ label: 'Mon', value: 90 });
    expect(result[1]).toEqual({ label: 'Tue', value: 15 });
    expect(result[2].value).toBe(0);
  });

  it('ignores rows with no createdAt', () => {
    const result = downtimeByWeekday([{ createdAt: null, downtimeMinutes: 100 }]);
    expect(result.every((r) => r.value === 0)).toBe(true);
  });
});

describe('lateByBuckets', () => {
  it('groups people into lateness buckets', () => {
    const rows = [
      { lateMinutes: 0 },
      { lateMinutes: 5 },
      { lateMinutes: 20 },
      { lateMinutes: 45 },
      { lateMinutes: 90 },
      { lateMinutes: 15 },
    ];
    expect(lateByBuckets(rows)).toEqual([
      { label: 'On Time', value: 1 },
      { label: '1-15 min', value: 2 },
      { label: '16-30 min', value: 1 },
      { label: '31-60 min', value: 1 },
      { label: '60+ min', value: 1 },
    ]);
  });

  it('treats negative lateness as On Time', () => {
    expect(lateByBuckets([{ lateMinutes: -5 }])).toEqual([
      { label: 'On Time', value: 1 },
      { label: '1-15 min', value: 0 },
      { label: '16-30 min', value: 0 },
      { label: '31-60 min', value: 0 },
      { label: '60+ min', value: 0 },
    ]);
  });
});

describe('flattenPoLineItems', () => {
  it('produces one row per line item', () => {
    const pos = [
      {
        id: 'po1',
        poNumber: 'PO-001',
        supplierName: 'Acme',
        status: 'approved',
        raisedByName: 'Jane',
        raisedAt: '2026-01-01',
        items: [
          { partId: 'p1', partName: 'Bolt', quantityOrdered: 10, unitCost: 2 },
          { partId: 'p2', partName: 'Nut', quantityOrdered: 5, unitCost: 1 },
        ],
      },
    ];
    const rows = flattenPoLineItems(pos);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ poNumber: 'PO-001', itemName: 'Bolt', quantity: 10, unitPrice: 2, lineTotal: 20 });
    expect(rows[1]).toMatchObject({ poNumber: 'PO-001', itemName: 'Nut', quantity: 5, unitPrice: 1, lineTotal: 5 });
  });

  it('prefers the latest invoice revision price over the item unitCost', () => {
    const pos = [
      {
        id: 'po1',
        poNumber: 'PO-002',
        items: [{ partId: 'p1', partName: 'Bolt', quantityOrdered: 10, unitCost: 2 }],
        invoiceRevisions: [
          { items: [{ partId: 'p1', unitCost: 1.5 }] },
          { items: [{ partId: 'p1', unitCost: 1.8 }] },
        ],
      },
    ];
    const rows = flattenPoLineItems(pos);
    expect(rows[0].unitPrice).toBe(1.8);
    expect(rows[0].lineTotal).toBe(18);
  });

  it('returns no rows for a PO with no items', () => {
    expect(flattenPoLineItems([{ id: 'po1', poNumber: 'PO-003', items: [] }])).toEqual([]);
  });

  it('carries receivedAt through onto each line item', () => {
    const rows = flattenPoLineItems([
      {
        id: 'po1',
        poNumber: 'PO-004',
        raisedAt: '2026-01-01',
        receivedAt: '2026-01-10',
        items: [{ partId: 'p1', partName: 'Bolt', quantityOrdered: 5, unitCost: 4 }],
      },
    ]);
    expect(rows[0].receivedAt).toBe('2026-01-10');
  });
});

describe('topByTotalMarks', () => {
  it('sorts descending by evaluation + audit + quizzes and takes top N', () => {
    const rows = [
      { name: 'Alice', evaluationScore: 80, auditScore: 70, quizzesPassed: 5 },
      { name: 'Bob', evaluationScore: 90, auditScore: 90, quizzesPassed: 10 },
      { name: 'Carol', evaluationScore: 40, auditScore: 30, quizzesPassed: 1 },
      { name: 'Dave', evaluationScore: 60, auditScore: 60, quizzesPassed: 2 },
      { name: 'Eve', evaluationScore: 50, auditScore: 50, quizzesPassed: 3 },
      { name: 'Frank', evaluationScore: 20, auditScore: 20, quizzesPassed: 0 },
    ];
    const top = topByTotalMarks(rows, 5);
    expect(top).toHaveLength(5);
    expect(top[0]).toEqual({ label: 'Bob', value: 190 });
    expect(top.map((t) => t.label)).not.toContain('Frank');
  });

  it('treats missing fields as zero', () => {
    const top = topByTotalMarks([{ name: 'Solo' }], 5);
    expect(top).toEqual([{ label: 'Solo', value: 0 }]);
  });
});

describe('lateVsOnTimeCounts', () => {
  it('splits people into on time and late', () => {
    const result = lateVsOnTimeCounts([
      { lateMinutes: 0 },
      { lateMinutes: 12 },
      { lateMinutes: 0 },
      { lateMinutes: 750 },
    ]);
    expect(result).toEqual([
      { label: 'On time', value: 2 },
      { label: 'Late', value: 2 },
    ]);
  });

  it('counts a missing or negative value as on time', () => {
    const result = lateVsOnTimeCounts([{}, { lateMinutes: -5 }]);
    expect(result).toEqual([
      { label: 'On time', value: 2 },
      { label: 'Late', value: 0 },
    ]);
  });

  it('returns both buckets at zero for no rows', () => {
    expect(lateVsOnTimeCounts([])).toEqual([
      { label: 'On time', value: 0 },
      { label: 'Late', value: 0 },
    ]);
  });
});
