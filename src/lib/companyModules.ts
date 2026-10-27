/**
 * Per-company module switches. Lumora (platform superadmin) can turn whole
 * modules off for a company that doesn't need them: the tab disappears from
 * the sidebar and the pages refuse to open. Stored as `companies/{id}.disabledModules`
 * (written only by platformUpdateCompany → setModules). Core modules
 * (machines, work orders, breakdowns, users, settings, billing) can't be switched off.
 *
 * Keep the keys in sync with MODULE_KEYS in functions/src/platform/platformCompanies.js
 * (companyModules.test.ts checks it).
 */

export interface ModuleSwitch {
  key: string;
  label: string;
  /** Route prefixes the module owns (most specific first across the whole list). */
  prefixes: string[];
}

export const MODULE_SWITCHES: ModuleSwitch[] = [
  { key: 'purchaseOrders', label: 'Purchase orders', prefixes: ['/app/inventory/purchase-orders'] },
  { key: 'inventory', label: 'Inventory', prefixes: ['/app/inventory'] },
  { key: 'pm', label: 'Preventive maintenance', prefixes: ['/app/pm-schedules', '/app/pm'] },
  { key: 'contractors', label: 'Contractors', prefixes: ['/app/contractors'] },
  { key: 'shift', label: 'Shift handover', prefixes: ['/app/shift'] },
  { key: 'training', label: 'Training', prefixes: ['/app/training'] },
  { key: 'safety', label: 'Safety', prefixes: ['/app/safety'] },
  { key: 'analytics', label: 'Analytics', prefixes: ['/app/analytics', '/app/moe'] },
  { key: 'reports', label: 'Reports', prefixes: ['/app/reports'] },
  { key: 'audit', label: 'Audit', prefixes: ['/app/audit'] },
  { key: 'kaizen', label: 'Kaizen', prefixes: ['/app/kaizen'] },
  { key: 'evaluations', label: 'Evaluations', prefixes: ['/app/evaluations'] },
  { key: 'triage', label: 'Troubleshooting (triage)', prefixes: ['/app/triage'] },
];

export const MODULE_KEYS = MODULE_SWITCHES.map((m) => m.key);

/** The switchable module a path belongs to (most specific prefix wins), or null. */
export function moduleForPath(pathname: string): ModuleSwitch | null {
  let best: { m: ModuleSwitch; len: number } | null = null;
  for (const m of MODULE_SWITCHES) {
    for (const prefix of m.prefixes) {
      if ((pathname === prefix || pathname.startsWith(`${prefix}/`)) && (!best || prefix.length > best.len)) {
        best = { m, len: prefix.length };
      }
    }
  }
  return best ? best.m : null;
}

/** The module a path belongs to when Lumora has turned it off for this company, else null. */
export function disabledModuleForPath(
  company: { disabledModules?: string[] | null } | null | undefined,
  pathname: string,
): ModuleSwitch | null {
  const off = company?.disabledModules;
  if (!off || off.length === 0) return null;
  const m = moduleForPath(pathname);
  return m && off.includes(m.key) ? m : null;
}

/** False when Lumora has turned this module off for the company (unknown company = on). */
export function isModuleEnabled(
  company: { disabledModules?: string[] | null } | null | undefined,
  key: string,
): boolean {
  return !(company?.disabledModules ?? []).includes(key);
}
