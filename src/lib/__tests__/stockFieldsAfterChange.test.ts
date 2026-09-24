import { describe, it, expect } from 'vitest';
import { stockFieldsAfterChange } from '../inventory/stockCalculator';

describe('stockFieldsAfterChange', () => {
  it('recomputes available stock and the low-stock flag together', () => {
    expect(stockFieldsAfterChange({ minStockLevel: 6 }, 5, 0)).toEqual({
      currentStock: 5,
      reservedStock: 0,
      availableStock: 5,
      isLowStock: true,
    });
  });

  it('clears the low-stock flag once stock is back above the minimum', () => {
    expect(stockFieldsAfterChange({ minStockLevel: 6 }, 11, 2)).toEqual({
      currentStock: 11,
      reservedStock: 2,
      availableStock: 9,
      isLowStock: false,
    });
  });

  it('never goes negative and treats zero stock as out, not low', () => {
    expect(stockFieldsAfterChange({ minStockLevel: 3 }, -1, 4)).toEqual({
      currentStock: 0,
      reservedStock: 4,
      availableStock: 0,
      isLowStock: false,
    });
  });
});
