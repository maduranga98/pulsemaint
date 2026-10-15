import { describe, it, expect } from 'vitest';
import { computeDowntimeEvents } from '../machineDowntime';
// The Cloud Functions copy (MOE snapshots) must agree with the app.
// @ts-expect-error -- CommonJS Cloud Functions module, no type declarations
import server from '../../../functions/src/lib/machineDowntime.js';

const t = (iso: string) => new Date(iso);
const now = t('2026-10-15T12:00:00Z');

const breakdowns = [
  { id: 'b1', machineId: 'm1', status: 'closed', reportedAt: t('2026-10-10T08:00:00Z'), linkedWOId: 'w1' },
  { id: 'b2', machineId: 'm1', status: 'repair_in_progress', reportedAt: t('2026-10-14T06:00:00Z'), linkedWOId: 'w2' },
  { id: 'b3', machineId: 'm2', status: 'cancelled', reportedAt: t('2026-10-12T06:00:00Z') },
  { id: 'b4', machineId: 'm2', status: 'resolved', machineStillRunning: true, reportedAt: t('2026-10-11T06:00:00Z'), linkedWOId: 'w3' },
  { id: 'b5', machineId: 'm3', status: 'closed', reportedAt: t('2026-10-09T06:00:00Z'), closedAt: t('2026-10-09T10:00:00Z') },
];
const workOrders = [
  { id: 'w1', machineId: 'm1', status: 'CLOSED', linkedBreakdownId: 'b1', actualStartTime: t('2026-10-10T09:00:00Z'), supervisorSignOffAt: t('2026-10-11T08:00:00Z') },
  { id: 'w2', machineId: 'm1', status: 'IN_PROGRESS', linkedBreakdownId: 'b2', actualStartTime: t('2026-10-14T07:00:00Z') },
  { id: 'w3', machineId: 'm2', status: 'CLOSED', linkedBreakdownId: 'b4', actualStartTime: t('2026-10-11T10:00:00Z'), closedAt: t('2026-10-11T14:00:00Z') },
  { id: 'w4', machineId: 'm3', status: 'CLOSED', woType: 'PREVENTIVE', actualStartTime: t('2026-10-13T06:00:00Z'), supervisorSignOffAt: t('2026-10-13T08:30:00Z') },
];

const summarise = (events: Array<{ sourceId: string; kind: string; start: Date; end: Date; hours: number; ongoing: boolean }>) =>
  events
    .map((e) => ({ id: e.sourceId, kind: e.kind, start: e.start.toISOString(), end: e.end.toISOString(), hours: +e.hours.toFixed(6), ongoing: e.ongoing }))
    .sort((a, b) => a.id.localeCompare(b.id));

describe('server downtime copy', () => {
  it('produces exactly the events the app computes', () => {
    expect(summarise(server.computeDowntimeEvents(breakdowns, workOrders, now))).toEqual(
      summarise(computeDowntimeEvents(breakdowns, workOrders, now)),
    );
  });

  it('counts overlapping downtime on one machine once within a window', () => {
    const events = [
      { start: t('2026-10-15T00:00:00Z'), end: t('2026-10-15T06:00:00Z') },
      { start: t('2026-10-15T04:00:00Z'), end: t('2026-10-15T08:00:00Z') },
      { start: t('2026-10-14T20:00:00Z'), end: t('2026-10-15T01:00:00Z') },
    ];
    expect(server.downtimeMinutesInWindow(events, t('2026-10-15T00:00:00Z'), t('2026-10-15T23:59:59.999Z'))).toBe(8 * 60);
  });
});
