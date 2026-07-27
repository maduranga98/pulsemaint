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

// ---------------------------------------------------------------------------
// Inventory stock-status buckets — shared by Inventory Usage and Inventory
// Listing report charts ("Low Stock / Out of Stock / In Stock" counts).
// ---------------------------------------------------------------------------

export interface StockStatusPart {
  isLowStock?: boolean;
  currentStock?: number;
}

/**
 * Buckets a set of inventory parts into In Stock / Low Stock / Out of Stock
 * counts. A part with currentStock <= 0 is Out of Stock regardless of the
 * isLowStock flag; otherwise isLowStock decides Low Stock vs In Stock.
 */
export function computeStockStatusBuckets(
  parts: StockStatusPart[],
): Array<{ label: string; value: number }> {
  let inStock = 0;
  let lowStock = 0;
  let outOfStock = 0;
  parts.forEach((p) => {
    const stock = Number(p.currentStock ?? 0);
    if (stock <= 0) outOfStock += 1;
    else if (p.isLowStock) lowStock += 1;
    else inStock += 1;
  });
  return [
    { label: 'In Stock', value: inStock },
    { label: 'Low Stock', value: lowStock },
    { label: 'Out of Stock', value: outOfStock },
  ];
}

// ---------------------------------------------------------------------------
// Downtime Analysis — Downtime vs day-of-week the WO was created.
// ---------------------------------------------------------------------------

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export interface DowntimeRow {
  createdAt?: Date | null;
  downtimeMinutes?: number;
}

/**
 * Sums downtime minutes per day-of-week the WO was created, always returning
 * all 7 weekdays (Mon..Sun) in order, zero-filled where there's no data.
 */
export function downtimeByWeekday(rows: DowntimeRow[]): Array<{ label: string; value: number }> {
  const totals = new Array(7).fill(0);
  rows.forEach((r) => {
    if (!r.createdAt) return;
    const day = r.createdAt.getDay();
    totals[day] += Number(r.downtimeMinutes ?? 0);
  });
  // Reorder Sun-first totals into Mon..Sun for display.
  const order = [1, 2, 3, 4, 5, 6, 0];
  return order.map((day) => ({ label: WEEKDAY_LABELS[day], value: Math.round(totals[day]) }));
}

// ---------------------------------------------------------------------------
// Shift Handover Summary — "Late By" bucket counts of people.
// ---------------------------------------------------------------------------

const LATE_BUCKETS: Array<{ label: string; max: number }> = [
  { label: 'On Time', max: 0 },
  { label: '1-15 min', max: 15 },
  { label: '16-30 min', max: 30 },
  { label: '31-60 min', max: 60 },
  { label: '60+ min', max: Infinity },
];

/**
 * Buckets handovers by how late the person clocked in (minutes), returning a
 * count of people per bucket. Used by the Shift Handover Summary report's
 * "Late By" chart.
 */
export function lateByBuckets(rows: Array<{ lateMinutes?: number }>): Array<{ label: string; value: number }> {
  const counts = new Map<string, number>(LATE_BUCKETS.map((b) => [b.label, 0]));
  rows.forEach((r) => {
    const minutes = Math.max(0, Number(r.lateMinutes ?? 0));
    const bucket = LATE_BUCKETS.find((b) => minutes <= b.max) ?? LATE_BUCKETS[LATE_BUCKETS.length - 1];
    counts.set(bucket.label, (counts.get(bucket.label) ?? 0) + 1);
  });
  return LATE_BUCKETS.map((b) => ({ label: b.label, value: counts.get(b.label) ?? 0 }));
}

// ---------------------------------------------------------------------------
// Team Performance — Top 5 Employees vs Total Marks of all performances.
// ---------------------------------------------------------------------------

export interface TeamPerformanceMarksRow {
  name?: string;
  evaluationScore?: number;
  auditScore?: number;
  quizzesPassed?: number;
}

/**
 * "Total marks of all performances" composite: Evaluation Score + Audit Score
 * + Quizzes Passed. Trainings Completed is deliberately excluded — it's a
 * completion count, not a mark/score, so summing it directly into a 0-100-ish
 * scored total would skew the figure toward people who simply did more
 * trainings rather than performed better. Returns the top N employees by that
 * composite, descending, for the report's bar chart (x = employee name,
 * y = total marks).
 */
export function topByTotalMarks(
  rows: TeamPerformanceMarksRow[],
  count = 5,
): Array<{ label: string; value: number }> {
  return rows
    .map((r) => ({
      label: r.name ?? '',
      value: Number(r.evaluationScore ?? 0) + Number(r.auditScore ?? 0) + Number(r.quizzesPassed ?? 0),
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, count);
}

// ---------------------------------------------------------------------------
// PO History — flatten one PO into one row per line item.
// ---------------------------------------------------------------------------

export interface PoLineItemInput {
  partId?: string;
  partName?: string;
  quantityOrdered?: number;
  unitCost?: number;
}

export interface PoInvoiceRevisionInput {
  items?: Array<{ partId?: string; unitCost?: number }>;
}

export interface PoHistoryInput {
  id?: string;
  poNumber?: string;
  supplierName?: string;
  status?: string;
  raisedByName?: string;
  raisedAt?: unknown;
  receivedAt?: unknown;
  items?: PoLineItemInput[];
  invoiceRevisions?: PoInvoiceRevisionInput[];
}

export interface PoLineItemRow {
  poId: string;
  poNumber: string;
  supplierName: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  status: string;
  raisedByName: string;
  raisedAt: unknown;
  receivedAt: unknown;
}

/**
 * Flattens purchase orders into one row per line item — PO Code, Supplier,
 * Item, Quantity, Unit Price (most recent invoice revision's price for that
 * part, falling back to the item's own unitCost), Total, Status, Raised By,
 * Date. Used by the PO History report (one row per PO item, not per PO).
 */
export function flattenPoLineItems(pos: PoHistoryInput[]): PoLineItemRow[] {
  const rows: PoLineItemRow[] = [];
  pos.forEach((po) => {
    const revisions = po.invoiceRevisions ?? [];
    const latestRevision = revisions[revisions.length - 1];
    const items = po.items ?? [];
    items.forEach((item) => {
      const revisedItem = latestRevision?.items?.find((ri) => ri.partId === item.partId);
      const unitPrice = Number(revisedItem?.unitCost ?? item.unitCost ?? 0);
      const quantity = Number(item.quantityOrdered ?? 0);
      rows.push({
        poId: String(po.id ?? ''),
        poNumber: String(po.poNumber ?? ''),
        supplierName: String(po.supplierName ?? ''),
        itemName: String(item.partName ?? ''),
        quantity,
        unitPrice,
        lineTotal: quantity * unitPrice,
        status: String(po.status ?? ''),
        raisedByName: String(po.raisedByName ?? ''),
        raisedAt: po.raisedAt ?? null,
        receivedAt: po.receivedAt ?? null,
      });
    });
  });
  return rows;
}
