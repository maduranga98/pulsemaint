/**
 * Machine spare parts are ordinary inventory parts linked to the machine
 * through the part's `compatibleMachineIds` — so a spare part added while
 * registering a machine is a real inventory item, and anything linked from
 * the inventory side shows up on the machine too.
 *
 * Pure and Firebase-free so it can be unit-tested.
 */

export type SparePartStock = 'out' | 'low' | 'ok';

/** Same threshold the store keeper dashboard uses: at/below the reorder level. */
export function sparePartStockStatus(part: { currentStock?: number | null; minStockLevel?: number | null }): SparePartStock {
  const min = Number(part.minStockLevel ?? 0);
  const stock = Number(part.currentStock ?? 0);
  if (min <= 0) return 'ok';
  if (stock <= 0) return 'out';
  return stock <= min ? 'low' : 'ok';
}

export interface SparePartLike {
  id: string;
  name?: string | null;
  partNumber?: string | null;
  currentStock?: number | null;
  minStockLevel?: number | null;
  unit?: string | null;
  plantId?: string | null;
  compatibleMachineIds?: string[] | null;
}

export interface LowSparePart {
  partId: string;
  name: string;
  partNumber: string;
  currentStock: number;
  minStockLevel: number;
  unit: string;
  status: Exclude<SparePartStock, 'ok'>;
}

/** Parts linked to one machine, regardless of stock. */
export function sparePartsOfMachine<T extends SparePartLike>(parts: T[], machineId: string): T[] {
  return parts.filter((p) => (p.compatibleMachineIds ?? []).includes(machineId));
}

function toLow(p: SparePartLike): LowSparePart | null {
  const status = sparePartStockStatus(p);
  if (status === 'ok') return null;
  return {
    partId: p.id,
    name: p.name ?? 'Unnamed part',
    partNumber: p.partNumber ?? '',
    currentStock: Number(p.currentStock ?? 0),
    minStockLevel: Number(p.minStockLevel ?? 0),
    unit: p.unit ?? 'pcs',
    status,
  };
}

/** machineId → its spare parts that are low or out of stock (worst first). */
export function lowSparePartsByMachine(parts: SparePartLike[]): Map<string, LowSparePart[]> {
  const out = new Map<string, LowSparePart[]>();
  parts.forEach((p) => {
    const low = toLow(p);
    if (!low) return;
    (p.compatibleMachineIds ?? []).forEach((machineId) => {
      if (!out.has(machineId)) out.set(machineId, []);
      out.get(machineId)!.push(low);
    });
  });
  out.forEach((list) =>
    list.sort((a, b) => (a.status === b.status ? a.currentStock - b.currentStock : a.status === 'out' ? -1 : 1)),
  );
  return out;
}

/** Machines that have low spare parts first; otherwise the original order. */
export function sortLowSpareFirst<T extends { id: string }>(machines: T[], lowByMachine: Map<string, LowSparePart[]>): T[] {
  const indexed = machines.map((m, i) => ({ m, i, low: lowByMachine.has(m.id) }));
  indexed.sort((a, b) => (a.low === b.low ? a.i - b.i : a.low ? -1 : 1));
  return indexed.map((x) => x.m);
}

/** What the editor holds for each spare part row. `partId` null = new part to create. */
export interface SparePartEntry {
  partId: string | null;
  name: string;
  partNumber: string;
  category: string;
  unit: string;
  currentStock: number;
  minStockLevel: number;
  unitCost: number;
}
