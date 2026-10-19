/** Pure helpers for a machine's asset value, scrapping and outsourced maintenance cost. */

const MS_PER_YEAR = 365.25 * 24 * 3600 * 1000;

export const SCRAP_REASONS = ['broken', 'old', 'uneconomical', 'replaced', 'other'] as const;
export type ScrapReason = (typeof SCRAP_REASONS)[number];

export const SCRAP_REASON_LABEL: Record<ScrapReason, string> = {
  broken: 'Broken beyond repair',
  old: 'Too old',
  uneconomical: 'Not worth repairing',
  replaced: 'Replaced by a new machine',
  other: 'Other',
};

export interface OutsourcedPart {
  name: string;
  partNumber?: string;
  /** Fitted new (replaced a worn part) or added as an upgrade. */
  kind: 'replaced' | 'added';
  quantity: number;
  unitPrice: number;
}

const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0);

export function partLineTotal(p: Pick<OutsourcedPart, 'quantity' | 'unitPrice'>): number {
  return num(p.quantity) * num(p.unitPrice);
}

/** Parts + labour/service charge for one outsourced job. */
export function outsourcedJobTotals(parts: OutsourcedPart[], labourCost: number): { partsTotal: number; total: number } {
  const partsTotal = parts.reduce((s, p) => s + partLineTotal(p), 0);
  return { partsTotal, total: partsTotal + num(labourCost) };
}

/**
 * Straight-line book value: falls evenly from the purchase price to the scrap value over the expected
 * lifespan, and never goes below the scrap value. Null when there is not enough data.
 */
export function bookValue(opts: {
  purchasePrice: number | null | undefined;
  scrapValue?: number | null;
  purchasedAtMs: number | null | undefined;
  lifespanYears: number | null | undefined;
  now?: number;
}): number | null {
  const price = num(opts.purchasePrice);
  if (!price || !opts.purchasedAtMs || !num(opts.lifespanYears)) return null;
  const salvage = Math.min(num(opts.scrapValue), price);
  const ageYears = Math.max(0, ((opts.now ?? Date.now()) - opts.purchasedAtMs) / MS_PER_YEAR);
  const fraction = Math.min(1, ageYears / (opts.lifespanYears as number));
  return Math.round(price - (price - salvage) * fraction);
}

export type ReplaceAdvice = 'ok' | 'watch' | 'replace';

/**
 * Repair-or-replace signal from what has been spent keeping the machine running.
 * "replace" once maintenance spend reaches 60% of the purchase price or exceeds the machine's book value;
 * "watch" from 40%.
 */
export function replaceAdvice(opts: { purchasePrice: number | null | undefined; maintenanceCost: number; bookValue: number | null }): ReplaceAdvice {
  const price = num(opts.purchasePrice);
  if (!price || opts.maintenanceCost <= 0) return 'ok';
  const ratio = opts.maintenanceCost / price;
  if (ratio >= 0.6 || (opts.bookValue != null && opts.maintenanceCost > opts.bookValue)) return 'replace';
  return ratio >= 0.4 ? 'watch' : 'ok';
}
