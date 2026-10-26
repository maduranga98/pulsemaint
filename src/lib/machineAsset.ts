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

/** Share of the purchase price expected back as scrap, by expected lifespan: the longer a machine runs, the less is left. */
export function scrapPercentForLifespan(lifespanYears: number): number {
  if (lifespanYears < 5) return 20;
  if (lifespanYears <= 10) return 10;
  return 5;
}

/**
 * Expected scrap value, worked out from the purchase price and expected lifespan (nobody types it):
 * 20% of the price for under 5 years, 10% for 5-10 years, 5% for over 10 years. Null without price or lifespan.
 */
export function expectedScrapValue(opts: {
  purchasePrice: number | null | undefined;
  lifespanYears: number | null | undefined;
}): { value: number; percent: number } | null {
  const price = num(opts.purchasePrice);
  const years = num(opts.lifespanYears);
  if (!price || !years) return null;
  const percent = scrapPercentForLifespan(years);
  return { value: Math.round((price * percent) / 100), percent };
}

/**
 * Straight-line book value: falls evenly from the purchase price to the expected scrap value over the
 * expected lifespan, and never goes below the scrap value. Null when there is not enough data.
 */
export function bookValue(opts: {
  purchasePrice: number | null | undefined;
  purchasedAtMs: number | null | undefined;
  lifespanYears: number | null | undefined;
  now?: number;
}): number | null {
  const price = num(opts.purchasePrice);
  const scrap = expectedScrapValue(opts);
  if (!price || !opts.purchasedAtMs || !scrap) return null;
  const ageYears = Math.max(0, ((opts.now ?? Date.now()) - opts.purchasedAtMs) / MS_PER_YEAR);
  const fraction = Math.min(1, ageYears / (opts.lifespanYears as number));
  return Math.round(price - (price - scrap.value) * fraction);
}

/** Straight-line depreciation per year: (price - expected scrap value) / lifespan. Null without price or lifespan. */
export function annualDepreciation(opts: {
  purchasePrice: number | null | undefined;
  lifespanYears: number | null | undefined;
}): number | null {
  const price = num(opts.purchasePrice);
  const scrap = expectedScrapValue(opts);
  if (!price || !scrap) return null;
  return Math.round((price - scrap.value) / (opts.lifespanYears as number));
}

/** Depreciation written off so far (price minus current book value) and its share of the price, 0-100. */
export function depreciationSoFar(purchasePrice: number | null | undefined, book: number | null): { amount: number; percent: number } | null {
  const price = num(purchasePrice);
  if (!price || book == null) return null;
  const amount = Math.max(0, price - book);
  return { amount, percent: Math.round((amount / price) * 100) };
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

const FINISHED_WO = new Set(['COMPLETED', 'SIGNED_OFF', 'CLOSED']);

/**
 * What one finished work order cost: parts taken from stock or bought, plus the contractor's own charge on
 * contractor work orders. Unfinished work orders count as 0.
 */
export function workOrderCost(wo: {
  status: string;
  partsUsed?: { quantity?: number; unitCost?: number; totalCost?: number }[] | null;
  projectCost?: number | null;
}): number {
  if (!FINISHED_WO.has(wo.status)) return 0;
  const parts = (wo.partsUsed ?? []).reduce((s, p) => s + (num(p.totalCost) || num(p.quantity) * num(p.unitCost)), 0);
  return parts + num(wo.projectCost);
}
