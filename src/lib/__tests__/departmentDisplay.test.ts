import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import {
  canManageDepartmentDisplay,
  daysFromToday,
  displayUrl,
  groupByMonth,
  intlLocale,
  isAllDay,
  openFor,
  progressPercent,
  todayWindow,
} from '../departmentDisplay';

const nodeRequire = createRequire(import.meta.url);
const logic = nodeRequire('../../../functions/src/displays/displayLogic.js');

const HOUR = 3600e3;
const DAY = 24 * HOUR;
const NOW = new Date(2026, 10, 4, 10, 0, 0).getTime(); // 4 Nov 2026, 10:00 local
const WIN = { start: new Date(2026, 10, 4).getTime(), end: new Date(2026, 10, 5).getTime() };

const ticket = (over: Record<string, unknown>) => ({
  machineName: 'Filler F-02',
  description: 'Conveyor jam',
  machinePlantId: 'p1',
  status: 'reported',
  reportedAt: NOW - 18 * 60000,
  ...over,
});
const wo = (over: Record<string, unknown>) => ({
  machineName: 'Capper C-04',
  description: 'Replace belt',
  machinePlantId: 'p1',
  woType: 'CORRECTIVE',
  status: 'OPEN',
  scheduledStart: NOW + 4 * HOUR,
  estimatedDuration: 2,
  estimatedDurationUnit: 'hours',
  ...over,
});
const pm = (over: Record<string, unknown>) => ({
  machineName: 'Conveyor CV-1',
  name: 'Monthly inspection',
  plantId: 'p1',
  status: 'active',
  nextDueDate: WIN.start + DAY,
  noEndDate: true,
  endDate: null,
  estimatedDuration: 45 / 60,
  estimatedDurationUnit: 'hours',
  ...over,
});
const build = (over: Partial<Record<'tickets' | 'workOrders' | 'pmSchedules', unknown[]>>) =>
  logic.buildDisplayPayload({ now: NOW, win: WIN, plantId: 'p1', tickets: [], workOrders: [], pmSchedules: [], ...over });

describe('who may share a department', () => {
  it('allows only supervisor, plant manager and admin', () => {
    for (const r of ['supervisor', 'plant_manager', 'admin'] as const) expect(canManageDepartmentDisplay(r)).toBe(true);
    for (const r of ['safety_officer', 'hr_officer', 'store_keeper', 'trainee', 'technician', 'floor_operator'] as const) {
      expect(canManageDepartmentDisplay(r)).toBe(false);
    }
    expect(canManageDepartmentDisplay(undefined)).toBe(false);
  });
});

describe('server: breakdowns', () => {
  it('maps open statuses to the four steps and flags a fresh report', () => {
    const out = build({
      tickets: [
        ticket({ status: 'reported' }),
        ticket({ status: 'repair_in_progress', reportedAt: NOW - 3 * HOUR }),
        ticket({ status: 'on_hold_parts', reportedAt: NOW - 5 * HOUR }),
      ],
    });
    expect(out.breakdowns.map((b: { status: string }) => b.status)).toEqual(['reported', 'attending', 'waiting_parts']);
    expect(out.breakdowns[0].fresh).toBe(true);
    expect(out.breakdowns[1].fresh).toBe(false);
    expect(out.breakdowns.map((b: { step: number }) => b.step)).toEqual([0, 1, 2]);
  });

  it('shows resolved tickets only when fixed today and never closed or cancelled ones', () => {
    const out = build({
      tickets: [
        ticket({ status: 'resolved', resolvedAt: WIN.start + HOUR }),
        ticket({ status: 'resolved', resolvedAt: WIN.start - HOUR }),
        ticket({ status: 'closed' }),
        ticket({ status: 'cancelled' }),
      ],
    });
    expect(out.breakdowns).toHaveLength(1);
    expect(out.breakdowns[0]).toMatchObject({ status: 'fixed', fixed: true, step: 3 });
  });

  it('lists open breakdowns before fixed ones', () => {
    const out = build({ tickets: [ticket({ status: 'resolved', resolvedAt: WIN.start + HOUR }), ticket({ status: 'assigned' })] });
    expect(out.breakdowns.map((b: { fixed: boolean }) => b.fixed)).toEqual([false, true]);
  });

  it('ignores another plant, and never leaks people or costs', () => {
    const out = build({
      tickets: [ticket({ machinePlantId: 'p2' }), ticket({ reporterName: 'Nimal', assignedTechnicianNames: ['Kamal'], cost: 99 })],
    });
    expect(out.breakdowns).toHaveLength(1);
    expect(Object.keys(out.breakdowns[0]).sort()).toEqual(['at', 'fixed', 'fresh', 'machine', 'status', 'step', 'what']);
  });
});

describe('server: maintenance today and scheduled', () => {
  it('splits work orders into running, today and later, and drops overdue and breakdown ones', () => {
    const out = build({
      workOrders: [
        wo({ status: 'IN_PROGRESS', scheduledStart: NOW - HOUR }),
        wo({ status: 'ASSIGNED', scheduledStart: NOW + 4 * HOUR }),
        wo({ status: 'OPEN', scheduledStart: WIN.end + 3 * DAY }),
        wo({ status: 'OPEN', scheduledStart: WIN.start - 2 * DAY }), // overdue
        wo({ status: 'OPEN', scheduledStart: NOW + HOUR, woType: 'BREAKDOWN' }),
        wo({ status: 'COMPLETED', scheduledStart: NOW + HOUR }),
        wo({ status: 'OPEN', scheduledStart: WIN.start + 400 * DAY }), // beyond a year
      ],
    });
    expect(out.maintenance.map((m: { status: string }) => m.status)).toEqual(['running', 'scheduled_today']);
    expect(out.scheduled).toHaveLength(1);
    expect(out.scheduled[0].type).toBe('WO');
  });

  it('puts a preventive work order and PM schedules in the PM type, skips overdue PM', () => {
    const out = build({
      workOrders: [wo({ woType: 'PREVENTIVE', status: 'OPEN', scheduledStart: WIN.end + DAY })],
      pmSchedules: [
        pm({ nextDueDate: WIN.start + HOUR }), // today
        pm({ nextDueDate: WIN.start + 30 * DAY }),
        pm({ nextDueDate: WIN.start - DAY }), // overdue: hidden
        pm({ status: 'paused' }),
        pm({ noEndDate: false, endDate: WIN.start + DAY, nextDueDate: WIN.start + 10 * DAY }), // ended before due
      ],
    });
    expect(out.maintenance).toHaveLength(1);
    expect(out.maintenance[0]).toMatchObject({ type: 'PM', status: 'scheduled_today', stopMin: 45 });
    expect(out.scheduled.map((s: { type: string }) => s.type)).toEqual(['PM', 'PM']);
    expect(out.scheduled[0].from).toBeLessThan(out.scheduled[1].from);
  });

  it('converts day durations to minutes', () => {
    expect(logic.durationMinutes({ estimatedDuration: 2, estimatedDurationUnit: 'days' })).toBe(2880);
    expect(logic.durationMinutes({ estimatedDuration: 1.5, estimatedDurationUnit: 'hours' })).toBe(90);
    expect(logic.durationMinutes({})).toBe(0);
  });

  it('marks an on-hold-for-parts work order as waiting for parts', () => {
    const out = build({ workOrders: [wo({ status: 'ON_HOLD_PARTS', scheduledStart: NOW - HOUR })] });
    expect(out.maintenance[0].status).toBe('waiting_parts');
  });
});

describe('server: day window', () => {
  it('accepts the viewer window and falls back to the UTC day when it is implausible', () => {
    expect(logic.dayWindow(NOW, WIN.start, WIN.end)).toEqual({ start: WIN.start, end: WIN.end });
    const bad = logic.dayWindow(NOW, 1, 2);
    expect(bad.end - bad.start).toBe(DAY);
    expect(bad.start <= NOW && NOW < bad.end).toBe(true);
  });
});

describe('client helpers', () => {
  it('builds today from local midnight', () => {
    const w = todayWindow(new Date(2026, 10, 4, 15, 30));
    expect(w.dayStartMs).toBe(WIN.start);
    expect(w.dayEndMs).toBe(WIN.end);
  });

  it('reports how long a breakdown has been open', () => {
    expect(openFor(NOW - 18 * 60000, NOW)).toEqual({ hours: 0, minutes: 18 });
    expect(openFor(NOW - 95 * 60000, NOW)).toEqual({ hours: 1, minutes: 35 });
    expect(openFor(NOW, NOW)).toEqual({ hours: 0, minutes: 1 });
  });

  it('computes progress within 0-100', () => {
    expect(progressPercent(0, 100, 50)).toBe(50);
    expect(progressPercent(0, 100, -5)).toBe(0);
    expect(progressPercent(0, 100, 500)).toBe(100);
    expect(progressPercent(10, 10, 20)).toBe(0);
  });

  it('treats local midnight as a date without a time', () => {
    expect(isAllDay(WIN.start)).toBe(true);
    expect(isAllDay(WIN.start + 9 * HOUR)).toBe(false);
  });

  it('counts whole days from today', () => {
    expect(daysFromToday(WIN.end + HOUR, NOW)).toBe(1);
    expect(daysFromToday(WIN.start + 9 * DAY + HOUR, NOW)).toBe(9);
  });

  it('groups sorted items by month', () => {
    const items = [
      { from: new Date(2026, 10, 5).getTime() },
      { from: new Date(2026, 10, 28).getTime() },
      { from: new Date(2026, 11, 2).getTime() },
    ];
    const groups = groupByMonth(items, 'en-GB');
    expect(groups.map((g) => g.items.length)).toEqual([2, 1]);
    expect(groups[0].label).toBe('November 2026');
  });

  it('maps app languages to Intl locales and builds the link', () => {
    expect(intlLocale('en-US')).toBe('en-GB');
    expect(intlLocale('si')).toBe('si-LK');
    expect(intlLocale('de')).toBe('de');
    expect(displayUrl('abc', 'https://app.example.com/')).toBe('https://app.example.com/display/abc');
  });
});
