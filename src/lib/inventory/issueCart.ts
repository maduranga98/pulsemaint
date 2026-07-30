import type { InventoryPart } from '@/types/inventory';

/**
 * One line of a bulk "Scan & Issue" batch: a part plus the quantity to issue
 * from stock. A snapshot of the stock and cost at scan time is kept so the
 * cart can be validated and totalled without re-reading Firestore — the issue
 * transaction re-reads and re-checks stock at commit time regardless.
 */
export interface IssueCartLine {
  partId: string;
  partNumber: string;
  partName: string;
  unit: string;
  unitCost: number;
  storeLocation: string;
  /** Available stock as seen when the part was scanned. */
  availableStock: number;
  /** Quantity to issue. */
  quantity: number;
}

/** Turns a scanned part into a fresh cart line with a quantity of 1. */
export function toCartLine(part: InventoryPart): IssueCartLine {
  return {
    partId: part.id,
    partNumber: part.partNumber,
    partName: part.name,
    unit: part.unit,
    unitCost: part.unitCost ?? 0,
    storeLocation: part.storeLocation ?? '',
    availableStock: part.currentStock ?? 0,
    quantity: 1,
  };
}

/**
 * Adds a scanned part to the batch. Scanning a part that is already in the
 * cart bumps its quantity by one (never past the stock it was scanned with)
 * rather than adding a duplicate line, and refreshes the stock/cost snapshot
 * in case the part changed since it was first scanned.
 */
export function addScannedPart(lines: IssueCartLine[], part: InventoryPart): IssueCartLine[] {
  const existing = lines.find((line) => line.partId === part.id);
  if (!existing) {
    return [...lines, toCartLine(part)];
  }
  const refreshedStock = part.currentStock ?? 0;
  return lines.map((line) =>
    line.partId === part.id
      ? {
          ...line,
          availableStock: refreshedStock,
          unitCost: part.unitCost ?? line.unitCost,
          storeLocation: part.storeLocation ?? line.storeLocation,
          quantity: Math.min(refreshedStock, line.quantity + 1),
        }
      : line,
  );
}

/** Sets a line's quantity, clamped to a whole number of at least 1. */
export function setLineQuantity(
  lines: IssueCartLine[],
  partId: string,
  quantity: number,
): IssueCartLine[] {
  const safe = Number.isFinite(quantity) ? Math.max(1, Math.floor(quantity)) : 1;
  return lines.map((line) => (line.partId === partId ? { ...line, quantity: safe } : line));
}

/** Removes a line from the batch. */
export function removeLine(lines: IssueCartLine[], partId: string): IssueCartLine[] {
  return lines.filter((line) => line.partId !== partId);
}

/**
 * The problem with a single line, if any — used to badge the row and to block
 * submission. `null` means the line is issuable given the stock last seen.
 */
export function cartLineError(line: IssueCartLine): string | null {
  if (line.quantity <= 0) return 'Quantity must be at least 1.';
  if (line.quantity > line.availableStock) {
    return `Only ${line.availableStock} ${line.unit} in stock.`;
  }
  return null;
}

/** Whether every line in a non-empty batch can be issued. */
export function isCartIssuable(lines: IssueCartLine[]): boolean {
  return lines.length > 0 && lines.every((line) => cartLineError(line) === null);
}

/** Batch roll-up for the summary bar. */
export function cartTotals(lines: IssueCartLine[]): {
  lineCount: number;
  totalQuantity: number;
  totalCost: number;
} {
  return lines.reduce(
    (acc, line) => ({
      lineCount: acc.lineCount + 1,
      totalQuantity: acc.totalQuantity + line.quantity,
      totalCost: acc.totalCost + line.unitCost * line.quantity,
    }),
    { lineCount: 0, totalQuantity: 0, totalCost: 0 },
  );
}
