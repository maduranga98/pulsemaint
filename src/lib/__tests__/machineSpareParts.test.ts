import { describe, it, expect } from 'vitest';
import { lowSparePartsByMachine, sortLowSpareFirst, sparePartStockStatus, sparePartsOfMachine } from '../machineSpareParts';

const parts = [
  { id: 'p1', name: 'Bearing', currentStock: 2, minStockLevel: 5, compatibleMachineIds: ['m1', 'm2'] },
  { id: 'p2', name: 'Belt', currentStock: 0, minStockLevel: 3, compatibleMachineIds: ['m1'] },
  { id: 'p3', name: 'Seal', currentStock: 10, minStockLevel: 3, compatibleMachineIds: ['m1'] },
  { id: 'p4', name: 'Loose', currentStock: 0, minStockLevel: 0, compatibleMachineIds: ['m3'] },
];

describe('machine spare parts', () => {
  it('classifies stock like the inventory dashboard', () => {
    expect(sparePartStockStatus({ currentStock: 0, minStockLevel: 3 })).toBe('out');
    expect(sparePartStockStatus({ currentStock: 5, minStockLevel: 5 })).toBe('low');
    expect(sparePartStockStatus({ currentStock: 6, minStockLevel: 5 })).toBe('ok');
    expect(sparePartStockStatus({ currentStock: 0, minStockLevel: 0 })).toBe('ok');
  });

  it('lists low parts per machine, out of stock first', () => {
    const map = lowSparePartsByMachine(parts);
    expect(map.get('m1')!.map((p) => p.partId)).toEqual(['p2', 'p1']);
    expect(map.get('m2')!.map((p) => p.partId)).toEqual(['p1']);
    expect(map.has('m3')).toBe(false);
  });

  it('finds a machine’s parts and floats low-stock machines to the top', () => {
    expect(sparePartsOfMachine(parts, 'm1')).toHaveLength(3);
    const sorted = sortLowSpareFirst([{ id: 'm3' }, { id: 'm1' }, { id: 'm4' }, { id: 'm2' }], lowSparePartsByMachine(parts));
    expect(sorted.map((m) => m.id)).toEqual(['m1', 'm2', 'm3', 'm4']);
  });
});
