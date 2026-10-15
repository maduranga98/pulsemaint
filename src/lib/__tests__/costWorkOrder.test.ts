import { describe, it, expect } from 'vitest';
// @ts-expect-error -- CommonJS Cloud Functions module, no type declarations
import server from '../../../functions/src/workorders/costWorkOrder.js';

describe('costWorkOrder.costFields', () => {
  it('prices uncosted parts from inventory and logged hours at each labour rate', () => {
    const wo = {
      partsUsed: [
        { partId: 'p1', quantity: 2, unitCost: 0, totalCost: 0 },
        { partId: 'p2', quantity: 1, unitCost: 50, totalCost: 50 },
      ],
      technicianWorkLogs: [
        { technicianId: 'u1', hoursWorked: 3 },
        { technicianId: 'u2', hoursWorked: 1.5 },
      ],
    };
    const out = server.costFields(wo, new Map([['p1', 120]]), new Map([['u1', 400]]));
    expect(out.partsUsed[0]).toMatchObject({ unitCost: 120, totalCost: 240 });
    expect(out.partsUsed[1]).toMatchObject({ unitCost: 50, totalCost: 50 });
    expect(out.totalPartsCost).toBe(290);
    expect(out.technicianWorkLogs[0]).toMatchObject({ laborRate: 400, laborCost: 1200 });
    // No rate on record for u2: no cost invented, and the total is flagged as a floor.
    expect(out.technicianWorkLogs[1]).toMatchObject({ laborRate: null, laborCost: null });
    expect(out.totalLaborCost).toBe(1200);
    expect(out.laborCostComplete).toBe(false);
  });

  it('is complete when everyone who logged hours has a rate', () => {
    const out = server.costFields({ technicianWorkLogs: [{ technicianId: 'u1', hoursWorked: 2 }] }, new Map(), new Map([['u1', 100]]));
    expect(out).toMatchObject({ totalLaborCost: 200, totalPartsCost: 0, laborCostComplete: true });
  });
});
