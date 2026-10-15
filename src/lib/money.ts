/** Pure money formatting (no app state) — see lib/currency.ts for the company-currency wrappers. */

/** "USD 8,500" — whole units by default. */
export function formatMoneyIn(currency: string, amount: number | null | undefined, decimals = 0): string {
  const n = Number(amount ?? 0);
  return `${currency} ${n.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
}

/** "USD 8.5K" for KPI tiles and chart axes. */
export function formatMoneyCompactIn(currency: string, amount: number | null | undefined): string {
  const n = Number(amount ?? 0);
  if (Math.abs(n) >= 1_000_000) return `${currency} ${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1000) return `${currency} ${(n / 1000).toFixed(Math.abs(n) >= 10000 ? 0 : 1)}K`;
  return `${currency} ${Math.round(n)}`;
}
