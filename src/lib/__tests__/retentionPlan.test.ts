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

describe('retention is gated on an export', () => {
  const { classify, ownedFilePaths } = require('../../../functions/src/retention/retentionPlan.js');
  const wo = rule('workOrders', 'closedAt');
  const closed = (daysAgo: number) => ({ status: 'CLOSED', closedAt: ts(daysAgo), companyId: 'A' });

  it('keeps expired records until an export has completed', () => {
    expect(classify(wo, closed(400), NOW, null)).toBe('blocked');
  });
  it('clears them once an export that started after they finished exists', () => {
    expect(classify(wo, closed(400), NOW, NOW - 10 * DAY)).toBe('delete');
  });
  it('still waits for records that finished after the last export', () => {
    // closed 366 days ago: an export from 380 days ago predates it, one from 360 days ago covers it
    expect(classify(wo, closed(366), NOW, NOW - 380 * DAY)).toBe('blocked');
    expect(classify(wo, closed(366), NOW, NOW - 360 * DAY)).toBe('delete');
  });
  it('never touches records inside the year or open work', () => {
    expect(classify(wo, closed(100), NOW, null)).toBe('keep');
    expect(classify(wo, { status: 'IN_PROGRESS', closedAt: ts(900), companyId: 'A' }, NOW, null)).toBe('keep');
  });
  it('clears import-session clutter without waiting (it is not exported)', () => {
    const r = rule('inventoryImportSessions', 'createdAt');
    expect(classify(r, { createdAt: ts(500), companyId: 'A' }, NOW, null)).toBe('delete');
  });
  it('deletes only the files that sit in the record\'s own folder', () => {
    const own = 'breakdowns/A/bd1/media/a.png';
    const shared = 'breakdowns/A/other/media/b.png';
    const data = { companyId: 'A', photos: [`https://firebasestorage.googleapis.com/v0/b/bk/o/${encodeURIComponent(own)}?alt=media`, `gs://bk/${shared}`] };
    expect(ownedFilePaths('bd1', data, 'bk')).toEqual([own]);
  });
});
