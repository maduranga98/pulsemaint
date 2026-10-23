import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { MODULE_KEYS, moduleForPath, disabledModuleForPath } from '../companyModules';

describe('company module switches', () => {
  it('most specific prefix wins (purchase orders are not just inventory)', () => {
    expect(moduleForPath('/app/inventory/purchase-orders/new')?.key).toBe('purchaseOrders');
    expect(moduleForPath('/app/inventory/catalog')?.key).toBe('inventory');
  });
  it('core pages are not switchable', () => {
    for (const p of ['/app/machines', '/app/work-orders', '/app/breakdowns', '/app/settings', '/app/billing']) {
      expect(moduleForPath(p)).toBeNull();
    }
  });
  it('only blocks what is turned off', () => {
    const company = { disabledModules: ['training'] };
    expect(disabledModuleForPath(company, '/app/training/my-modules')?.key).toBe('training');
    expect(disabledModuleForPath(company, '/app/safety/cases')).toBeNull();
    expect(disabledModuleForPath({ disabledModules: [] }, '/app/training')).toBeNull();
    expect(disabledModuleForPath(null, '/app/training')).toBeNull();
  });
  it('server list matches', () => {
    const src = readFileSync(resolve(__dirname, '../../../functions/src/platform/platformCompanies.js'), 'utf8');
    const m = src.match(/const MODULE_KEYS = \[([^\]]*)\]/);
    expect(m).not.toBeNull();
    const server = (m![1].match(/"([^"]+)"/g) ?? []).map((s) => s.replace(/"/g, ''));
    expect(server).toEqual(MODULE_KEYS);
  });
});
