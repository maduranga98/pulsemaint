import { describe, it, expect } from 'vitest';
import { machineHealthScoreFromRecords, machineHealthInputs } from '../machineHealth';
// The Cloud Function that stores machines/{id}.healthScore must agree with the app.
// @ts-expect-error -- CommonJS Cloud Functions module, no type declarations
import server from '../../../functions/src/machines/machineHealth.js';

const t = (iso: string) => new Date(iso);
const now = t('2026-10-15T12:00:00Z');

const breakdowns = [
  { id: 'b1', status: 'closed', severity: 'critical', reportedAt: t('2026-10-01T08:00:00Z') }, // −20
  { id: 'b2', status: 'repair_in_progress', severity: 'high', reportedAt: t('2026-09-20T08:00:00Z') }, // −12
  { id: 'b3', status: 'assigned', severity: null, reportedAt: t('2026-10-14T08:00:00Z') }, // not assessed → medium −6
  { id: 'b4', status: 'cancelled', severity: 'critical', reportedAt: t('2026-10-02T08:00:00Z') }, // not a failure
  { id: 'b5', status: 'closed', severity: 'low', reportedAt: t('2026-06-01T08:00:00Z') }, // outside 90 days
];
const pmHistory = [
  { status: 'completed_on_time', dueDate: t('2026-09-01T00:00:00Z'), completedDate: t('2026-09-01T10:00:00Z') }, // +5
  { status: 'completed_on_time', dueDate: t('2026-10-01T00:00:00Z'), completedDate: t('2026-10-01T10:00:00Z') }, // +5
  { status: 'completed_late', dueDate: t('2026-09-15T00:00:00Z'), completedDate: t('2026-09-20T10:00:00Z') }, // 0
  { status: 'missed', dueDate: t('2026-08-20T00:00:00Z') }, // −10
  { status: 'in_progress', dueDate: t('2026-10-10T00:00:00Z') }, // open past due → −10
  { status: 'in_progress', dueDate: t('2026-10-20T00:00:00Z') }, // not due yet
  { status: 'missed', dueDate: t('2026-05-01T00:00:00Z') }, // outside 90 days
];

describe('machine health score', () => {
  it('follows the documented formula', () => {
    const inputs = machineHealthInputs('active', breakdowns, pmHistory, now);
    expect(inputs.breakdownsLast90Days.map((b) => b.severity)).toEqual(['critical', 'high', 'medium']);
    expect(inputs.overduePMs).toBe(2);
    expect(inputs.maintenanceCompletedLast90Days).toHaveLength(2);
    // 100 − 20 − 12 − 6 − 2×10 + 2×5
    expect(machineHealthScoreFromRecords('active', breakdowns, pmHistory, now)).toBe(52);
    // −5 while under maintenance
    expect(machineHealthScoreFromRecords('under_maintenance', breakdowns, pmHistory, now)).toBe(47);
    expect(machineHealthScoreFromRecords('active', [], [], now)).toBe(100);
  });

  it('caps the on-time PM credit at +20 and clamps to 0–100', () => {
    const manyOnTime = Array.from({ length: 10 }, (_, i) => ({
      status: 'completed_on_time',
      dueDate: t(`2026-10-0${(i % 9) + 1}T00:00:00Z`),
      completedDate: t(`2026-10-0${(i % 9) + 1}T01:00:00Z`),
    }));
    expect(machineHealthScoreFromRecords('active', [{ status: 'closed', severity: 'critical', reportedAt: t('2026-10-01T00:00:00Z') }], manyOnTime, now)).toBe(100);
    const many = Array.from({ length: 8 }, () => ({ status: 'closed', severity: 'critical', reportedAt: t('2026-10-01T00:00:00Z') }));
    expect(machineHealthScoreFromRecords('active', many, [], now)).toBe(0);
  });

  it('is computed identically by the Cloud Function', () => {
    for (const status of ['active', 'under_maintenance', 'decommissioned']) {
      expect(server.healthScore(status, breakdowns, pmHistory, now)).toBe(
        machineHealthScoreFromRecords(status, breakdowns, pmHistory, now),
      );
    }
    expect(server.healthScore('active', [], [], now)).toBe(100);
  });
});
