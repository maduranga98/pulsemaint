import type { InventoryPart, StockStatus } from '@/types/inventory';

export function getStockStatus(part: InventoryPart): StockStatus {
  if (part.currentStock <= 0) {
    return 'out_of_stock';
  }
  if (part.currentStock <= part.minStockLevel) {
    return 'low_stock';
  }
  return 'in_stock';
}

export function getAvailableStock(currentStock: number, reservedStock: number): number {
  return Math.max(0, currentStock - reservedStock);
}

export function isLowStock(currentStock: number, minStockLevel: number): boolean {
  return currentStock > 0 && currentStock <= minStockLevel;
}

export function formatLKR(amount: number): string {
  return `LKR ${amount.toLocaleString('en-LK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function getStockPercentage(current: number, min: number, max: number): number {
  if (max <= 0) {
    // If no max defined, use min as 100% threshold
    if (min <= 0) return current > 0 ? 100 : 0;
    return Math.min(100, Math.round((current / min) * 100));
  }
  if (current <= 0) return 0;
  return Math.min(100, Math.round((current / max) * 100));
}
