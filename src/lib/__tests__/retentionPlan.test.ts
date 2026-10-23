import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { RETENTION_RULES, NEVER_CLEARED, isExpired } = require('../../../functions/src/retention/retentionPlan.js');

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 9, 1);
const ts = (daysAgo: number) => ({ toMillis: () => NOW - daysAgo * DAY });
const rule = (collection: string, dateField: string) =>
  RETENTION_RULES.find((r: { collection: string; dateField: string }) => r.collection === collection && r.dateField === dateField);

describe('retention plan', () => {
  it('clears a work order closed more than a year ago', () => {
    expect(isExpired(rule('workOrders', 'closedAt'), { status: 'CLOSED', closedAt: ts(400) }, NOW)).toBe(true);
  });
  it('keeps one closed within the year', () => {
    expect(isExpired(rule('workOrders', 'closedAt'), { status: 'CLOSED', closedAt: ts(100) }, NOW)).toBe(false);
  });
  it('never clears open work, however old', () => {
    expect(isExpired(rule('workOrders', 'closedAt'), { status: 'IN_PROGRESS', closedAt: ts(900) }, NOW)).toBe(false);
    expect(isExpired(rule('breakdown_tickets', 'closedAt'), { status: 'open', closedAt: ts(900) }, NOW)).toBe(false);
    expect(isExpired(rule('safety_cases', 'closedAt'), { status: 'investigating', closedAt: ts(900) }, NOW)).toBe(false);
  });
  it('needs a finish date', () => {
    expect(isExpired(rule('workOrders', 'closedAt'), { status: 'CLOSED', closedAt: null }, NOW)).toBe(false);
  });
  it('ages inventory clutter by creation date', () => {
    expect(isExpired(rule('stockMovements', 'createdAt'), { createdAt: ts(500) }, NOW)).toBe(true);
  });
  it('never targets permanent data', () => {
    for (const keep of NEVER_CLEARED) {
      expect(RETENTION_RULES.some((r: { collection: string }) => r.collection === keep)).toBe(false);
    }
  });
});
