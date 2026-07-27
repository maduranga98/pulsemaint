// Small pure helpers used by the Reports feature (Maintenance Cost, Machine
// Health Score) — kept here, isolated from Firestore access, so they can be
// unit tested directly.

export interface MachineHealthRow {
  machineName: string;
  healthScore: number;
}

/**
 * Returns the top N rows by health score, descending, formatted as chart
 * data points. Used by the Machine Health Score report's PDF chart
 * ("Top 5 Machines by Health Score").
 */
export function topHealthScores(
  rows: MachineHealthRow[],
  count = 5,
): Array<{ label: string; value: number }> {
  return [...rows]
    .sort((a, b) => Number(b.healthScore ?? 0) - Number(a.healthScore ?? 0))
    .slice(0, count)
    .map((r) => ({ label: r.machineName ?? '', value: Number(r.healthScore ?? 0) }));
}

/**
 * Total cost for a single work order in the Maintenance Cost report: used
 * parts cost + labor cost + the contractor's "total project cost" captured
 * at sign-off (already includes its own auto-computed parts share — see
 * SignOffForm.tsx) for contractor work orders.
 */
export function computeWoTotalCost(
  partsCost: number,
  laborCost: number,
  contractorProjectCost: number,
): number {
  return (partsCost || 0) + (laborCost || 0) + (contractorProjectCost || 0);
}

/**
 * Sums Total Cost per WO Type — used by the Maintenance Cost report's chart
 * ("Total Cost vs WO Type").
 */
export function totalCostByWoType(
  rows: Array<{ woType?: unknown; totalCost?: unknown }>,
): Array<{ label: string; value: number }> {
  const totals = new Map<string, number>();
  rows.forEach((r) => {
    const key = String(r.woType ?? 'Unknown');
    totals.set(key, (totals.get(key) ?? 0) + Number(r.totalCost ?? 0));
  });
  return Array.from(totals.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
}
