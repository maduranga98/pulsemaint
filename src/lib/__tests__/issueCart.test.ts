import { describe, expect, it } from 'vitest';
import {
  addScannedPart,
  cartLineError,
  cartTotals,
  isCartIssuable,
  removeLine,
  setLineQuantity,
  toCartLine,
} from '../inventory/issueCart';
import type { InventoryPart } from '../../types/inventory';

function makePart(overrides: Partial<InventoryPart> = {}): InventoryPart {
  return {
    id: 'p1',
    partNumber: 'BRG-001',
    name: 'Bearing 6203',
    unit: 'pcs',
    unitCost: 5,
    storeLocation: 'A1',
    currentStock: 10,
    ...overrides,
  } as InventoryPart;
}

describe('toCartLine', () => {
  it('snapshots stock and cost with a starting quantity of 1', () => {
    const line = toCartLine(makePart());
    expect(line).toMatchObject({
      partId: 'p1',
      partNumber: 'BRG-001',
      partName: 'Bearing 6203',
      unit: 'pcs',
      unitCost: 5,
      storeLocation: 'A1',
      availableStock: 10,
      quantity: 1,
    });
  });
});

describe('addScannedPart', () => {
  it('adds a new part as its own line', () => {
    const lines = addScannedPart([], makePart());
    expect(lines).toHaveLength(1);
    expect(lines[0].quantity).toBe(1);
  });

  it('increments quantity instead of duplicating a re-scanned part', () => {
    const first = addScannedPart([], makePart());
    const second = addScannedPart(first, makePart());
    expect(second).toHaveLength(1);
    expect(second[0].quantity).toBe(2);
  });

  it('never bumps a re-scan past the available stock', () => {
    const start = [{ ...toCartLine(makePart({ currentStock: 2 })), quantity: 2 }];
    const next = addScannedPart(start, makePart({ currentStock: 2 }));
    expect(next[0].quantity).toBe(2);
  });

  it('keeps other lines untouched', () => {
    const lines = addScannedPart([toCartLine(makePart({ id: 'p2', partNumber: 'X' }))], makePart());
    expect(lines.map((l) => l.partId)).toEqual(['p2', 'p1']);
  });
});

describe('setLineQuantity', () => {
  it('sets a whole quantity of at least 1', () => {
    const lines = [toCartLine(makePart())];
    expect(setLineQuantity(lines, 'p1', 4)[0].quantity).toBe(4);
    expect(setLineQuantity(lines, 'p1', 0)[0].quantity).toBe(1);
    expect(setLineQuantity(lines, 'p1', 2.7)[0].quantity).toBe(2);
    expect(setLineQuantity(lines, 'p1', NaN)[0].quantity).toBe(1);
  });
});

describe('removeLine', () => {
  it('drops the matching line', () => {
    const lines = [toCartLine(makePart()), toCartLine(makePart({ id: 'p2' }))];
    expect(removeLine(lines, 'p1').map((l) => l.partId)).toEqual(['p2']);
  });
});

describe('cartLineError / isCartIssuable', () => {
  it('flags a quantity above stock', () => {
    const line = { ...toCartLine(makePart({ currentStock: 3 })), quantity: 5 };
    expect(cartLineError(line)).toBe('Only 3 pcs in stock.');
  });

  it('passes a quantity within stock', () => {
    const line = { ...toCartLine(makePart({ currentStock: 3 })), quantity: 3 };
    expect(cartLineError(line)).toBeNull();
  });

  it('is not issuable when empty', () => {
    expect(isCartIssuable([])).toBe(false);
  });

  it('is issuable only when every line is within stock', () => {
    const ok = { ...toCartLine(makePart()), quantity: 2 };
    const bad = { ...toCartLine(makePart({ id: 'p2', currentStock: 1 })), quantity: 5 };
    expect(isCartIssuable([ok])).toBe(true);
    expect(isCartIssuable([ok, bad])).toBe(false);
  });
});

describe('cartTotals', () => {
  it('rolls up line count, quantity, and cost', () => {
    const lines = [
      { ...toCartLine(makePart({ id: 'p1', unitCost: 5 })), quantity: 2 },
      { ...toCartLine(makePart({ id: 'p2', unitCost: 3 })), quantity: 4 },
    ];
    expect(cartTotals(lines)).toEqual({ lineCount: 2, totalQuantity: 6, totalCost: 22 });
  });

  it('is zeroed for an empty cart', () => {
    expect(cartTotals([])).toEqual({ lineCount: 0, totalQuantity: 0, totalCost: 0 });
  });
});
