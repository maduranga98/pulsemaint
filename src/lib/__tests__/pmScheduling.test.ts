import { describe, it, expect } from 'vitest';
// Server-side PM rules (Cloud Functions, CommonJS) — pure, no Firebase.
// @ts-expect-error -- CommonJS Cloud Functions module, no type declarations
import pm from '../../../functions/src/pm/pmScheduling.js';
// @ts-expect-error -- CommonJS Cloud Functions module, no type declarations
import zt from '../../../functions/src/lib/zonedTime.js';

const d = (iso: string) => new Date(iso);
const base = {
  status: 'active',
  triggerType: 'calendar',
  recurrenceType: 'weekly',
  customIntervalDays: null,
  leadTimeDays: 0,
  endDate: null,
};

describe('addMonthsClamped', () => {
  it('keeps the anchor day and clamps to month end without drifting', () => {
    expect(pm.addMonthsClamped(d('2026-01-31T00:00:00Z'), 1, 31).toISOString()).toBe('2026-02-28T00:00:00.000Z');
    expect(pm.addMonthsClamped(d('2026-02-28T00:00:00Z'), 1, 31).toISOString()).toBe('2026-03-31T00:00:00.000Z');
    expect(pm.addMonthsClamped(d('2026-11-15T00:00:00Z'), 3, 15).toISOString()).toBe('2027-02-15T00:00:00.000Z');
  });
});

describe('planCalendarRun', () => {
  const now = d('2026-10-15T00:30:00Z');

  it('raises the due occurrence and moves to the next one', () => {
    const plan = pm.planCalendarRun({ ...base, nextDueDate: d('2026-10-15T00:00:00Z') }, now);
    expect(plan.action).toBe('generate');
    expect(plan.dueDate.toISOString()).toBe('2026-10-15T00:00:00.000Z');
    expect(plan.nextDueDate.toISOString()).toBe('2026-10-22T00:00:00.000Z');
    expect(plan.skipped).toBe(0);
  });

  it('does nothing before the lead-time window, and raises within it', () => {
    const s = { ...base, nextDueDate: d('2026-10-18T00:00:00Z') };
    expect(pm.planCalendarRun({ ...s, leadTimeDays: 1 }, now).action).toBe('none');
    const plan = pm.planCalendarRun({ ...s, leadTimeDays: 3 }, now);
    expect(plan.action).toBe('generate');
    expect(plan.dueDate.toISOString()).toBe('2026-10-18T00:00:00.000Z');
  });

  it('collapses a backlog into one work order for the latest due occurrence', () => {
    const plan = pm.planCalendarRun({ ...base, nextDueDate: d('2026-08-20T00:00:00Z') }, now);
    expect(plan.action).toBe('generate');
    expect(plan.dueDate.toISOString()).toBe('2026-10-15T00:00:00.000Z');
    expect(plan.skipped).toBe(8);
    expect(plan.nextDueDate.toISOString()).toBe('2026-10-22T00:00:00.000Z');
  });

  it('completes a schedule past its end date and never raises after it', () => {
    expect(pm.planCalendarRun({ ...base, nextDueDate: d('2026-10-15T00:00:00Z'), endDate: d('2026-10-01T00:00:00Z') }, now).action).toBe('end');
    // The last occurrence before the end date is still raised.
    const plan = pm.planCalendarRun({ ...base, nextDueDate: d('2026-10-15T00:00:00Z'), endDate: d('2026-10-20T00:00:00Z') }, now);
    expect(plan.action).toBe('generate');
  });

  it('skips one-off, paused and usage schedules', () => {
    expect(pm.planCalendarRun({ ...base, recurrenceType: 'one_time', nextDueDate: d('2026-10-01T00:00:00Z') }, now).action).toBe('none');
    expect(pm.planCalendarRun({ ...base, status: 'paused', nextDueDate: d('2026-10-01T00:00:00Z') }, now).action).toBe('none');
    expect(pm.planCalendarRun({ ...base, triggerType: 'usage', nextDueDate: d('2026-10-01T00:00:00Z') }, now).action).toBe('none');
  });

  it('uses the peak-season interval inside the season, which recurs every year', () => {
    const seasonal = {
      ...base,
      recurrenceType: 'monthly',
      seasonalOverride: true,
      peakSeasonStart: d('2020-11-15T00:00:00Z'),
      peakSeasonEnd: d('2021-02-15T00:00:00Z'),
      peakSeasonInterval: 'weekly',
    };
    expect(pm.nextOccurrence(d('2026-12-01T00:00:00Z'), seasonal).toISOString()).toBe('2026-12-08T00:00:00.000Z');
    expect(pm.nextOccurrence(d('2026-06-01T00:00:00Z'), seasonal).toISOString()).toBe('2026-07-01T00:00:00.000Z');
  });
});

describe('usageState', () => {
  it('triggers at the threshold and measures from the last work order', () => {
    expect(pm.usageState({ triggerAfterValue: 500, currentMeterValue: 499 }).due).toBe(false);
    expect(pm.usageState({ triggerAfterValue: 500, currentMeterValue: 500 }).due).toBe(true);
    expect(pm.usageState({ triggerAfterValue: 500, currentMeterValue: 900, usageBaselineValue: 500 }).due).toBe(false);
    expect(pm.usageState({ triggerAfterValue: 500, currentMeterValue: 1000, usageBaselineValue: 500 }).due).toBe(true);
    // Meter reset since the last work order → counts from zero.
    expect(pm.usageState({ triggerAfterValue: 500, currentMeterValue: 120, usageBaselineValue: 600 }).due).toBe(false);
  });
});

describe('compliance', () => {
  it('counts each occurrence once (on time / late / missed)', () => {
    expect(pm.complianceRate({ completedOnTime: 3, completedLate: 1, missed: 0 })).toBe(75);
    expect(pm.complianceRate({})).toBe(100);
  });

  it('marks overdue after the escalation hours and missed after the auto-close days', () => {
    const h = { dueDate: d('2026-10-10T00:00:00Z'), overdueEscalationHours: 24, autoCloseAfterDays: 3 };
    expect(pm.openOccurrenceStatus(h, d('2026-10-10T12:00:00Z'))).toBe('in_progress');
    expect(pm.openOccurrenceStatus(h, d('2026-10-11T12:00:00Z'))).toBe('overdue');
    expect(pm.openOccurrenceStatus(h, d('2026-10-13T12:00:00Z'))).toBe('missed');
    // Older records without the settings use the PM form defaults (24 h / 3 days).
    expect(pm.openOccurrenceStatus({ dueDate: d('2026-10-10T00:00:00Z') }, d('2026-10-14T00:00:00Z'))).toBe('missed');
  });
});

describe('company-local days', () => {
  it('buckets an early-morning Colombo event on its local date', () => {
    expect(zt.localDateKey(d('2026-10-14T20:00:00Z'), 'Asia/Colombo')).toBe('2026-10-15');
    expect(zt.localDateKey(d('2026-10-14T20:00:00Z'), 'UTC')).toBe('2026-10-14');
  });
  it('gives the UTC window of a local day', () => {
    const w = zt.localDayWindow('2026-10-15', 'Asia/Colombo');
    expect(w.start.toISOString()).toBe('2026-10-14T18:30:00.000Z');
    expect(w.end.toISOString()).toBe('2026-10-15T18:29:59.999Z');
  });
  it('falls back to UTC for a missing or bad zone', () => {
    expect(zt.safeZone(undefined)).toBe('UTC');
    expect(zt.safeZone('Not/AZone')).toBe('UTC');
  });
});
