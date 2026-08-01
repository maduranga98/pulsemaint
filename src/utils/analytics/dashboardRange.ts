// Shared MTD/3M/6M/12M range control used by the Analytics page and the
// Manager/Admin dashboard's monthly-aggregate KPIs — both read from the same
// buildMonthlyAnalytics pipeline, which already accepts an array of months.
export type DashboardRange = 'mtd' | '3m' | '6m' | '12m';

export const DASHBOARD_RANGE_MONTHS: Record<DashboardRange, number> = {
  mtd: 1,
  '3m': 3,
  '6m': 6,
  '12m': 12,
};

export const DASHBOARD_RANGE_LABELS: Record<DashboardRange, string> = {
  mtd: 'MTD',
  '3m': '3M',
  '6m': '6M',
  '12m': '12M',
};

/** The list of 'YYYY-MM' months covered by a range, most-recent last. */
export function monthsForDashboardRange(range: DashboardRange): string[] {
  const count = DASHBOARD_RANGE_MONTHS[range];
  const now = new Date();
  const out: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return out;
}
