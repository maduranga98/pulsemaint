import { describe, it, expect } from 'vitest';
import {
  asDate,
  woLaborCost,
  woCost,
  woSlaOutcome,
  slaCompliance,
  contractorJobCost,
  contractorJobCostDate,
  elapsedHoursInMonths,
  mtbfDays,
} from '../analytics/maintenanceMetrics';
// The Cloud Functions copy (monthly analytics, machine health snapshots) must agree.
// @ts-expect-error -- CommonJS Cloud Functions module, no type declarations
import server from '../../../functions/src/lib/maintenanceMetrics.js';

const t = (iso: string) => new Date(iso);
const now = t('2026-10-15T12:00:00Z');

describe('asDate', () => {
  it('reads Dates, Firestore-like timestamps and strings', () => {
    expect(asDate(t('2026-01-01T00:00:00Z'))?.toISOString()).toBe('2026-01-01T00:00:00.000Z');
    expect(asDate({ seconds: 1_767_225_600 })?.toISOString()).toBe('2026-01-01T00:00:00.000Z');
    expect(asDate({ toDate: () => t('2026-02-01T00:00:00Z') })?.toISOString()).toBe('2026-02-01T00:00:00.000Z');
    expect(asDate(null)).toBeNull();
    expect(asDate('not a date')).toBeNull();
  });
});

describe('work order cost', () => {
  it('prefers the stamped totalLaborCost, else sums the work logs', () => {
    expect(woLaborCost({ totalLaborCost: 300, technicianWorkLogs: [{ laborCost: 50 }] })).toBe(300);
    expect(woLaborCost({ totalLaborCost: null, technicianWorkLogs: [{ laborCost: 50 }, { laborCost: 25 }] })).toBe(75);
    expect(woLaborCost({})).toBe(0);
  });

  it('is parts + labour', () => {
    expect(woCost({ partsUsed: [{ totalCost: 100 }, { totalCost: 20 }], totalLaborCost: 30 })).toBe(150);
  });
});

describe('SLA', () => {
  const deadline = t('2026-10-10T12:00:00Z');
  it('classifies each work order', () => {
    expect(woSlaOutcome({ status: 'CLOSED', slaDeadline: deadline, actualEndTime: t('2026-10-10T11:00:00Z') }, now)).toBe('met');
    expect(woSlaOutcome({ status: 'CLOSED', slaDeadline: deadline, actualEndTime: t('2026-10-10T13:00:00Z') }, now)).toBe('breached');
    expect(woSlaOutcome({ status: 'CLOSED', slaDeadline: deadline, slaBreached: true, actualEndTime: t('2026-10-10T11:00:00Z') }, now)).toBe('breached');
    expect(woSlaOutcome({ status: 'IN_PROGRESS', slaDeadline: deadline }, now)).toBe('breached');
    expect(woSlaOutcome({ status: 'IN_PROGRESS', slaDeadline: t('2026-10-16T00:00:00Z') }, now)).toBe('pending');
    expect(woSlaOutcome({ status: 'CANCELLED', slaDeadline: deadline }, now)).toBeNull();
    expect(woSlaOutcome({ status: 'CLOSED' }, now)).toBeNull();
  });

  it('is met / (met + breached) of the deadlines in the period; null when none fell due', () => {
    const wos = [
      { status: 'CLOSED', slaDeadline: deadline, actualEndTime: t('2026-10-10T11:00:00Z') },
      { status: 'CLOSED', slaDeadline: deadline, actualEndTime: t('2026-10-10T13:00:00Z') },
      { status: 'OPEN', slaDeadline: t('2026-10-20T00:00:00Z') },
      { status: 'CLOSED', slaDeadline: t('2026-09-10T00:00:00Z'), actualEndTime: t('2026-09-11T00:00:00Z') },
    ];
    const october = (d: Date) => d.toISOString().startsWith('2026-10');
    expect(slaCompliance(wos, october, now)).toEqual({ rate: 50, met: 1, breached: 1 });
    expect(slaCompliance([], october, now).rate).toBeNull();
  });
});

describe('contractor job cost', () => {
  it("counts the contractor's own charge, not the work order's parts again", () => {
    // Sign-off total 1500 = WO parts 400 + job parts 100 + project cost 1000.
    const signedOff = { projectCost: 1000, totalPartsCost: 500, totalProjectCost: 1500, systemInvoiceAmount: 1500,
      partsFromFactory: [{ totalCost: 100 }] };
    expect(contractorJobCost(signedOff)).toBe(1100);
    // Older record without projectCost: total minus the parts it included, plus the job's own parts.
    expect(contractorJobCost({ systemInvoiceAmount: 1500, totalPartsCost: 500, partsFromContractor: [{ estimatedCost: 100 }] })).toBe(1100);
    // Before sign-off: the contractor's invoice.
    expect(contractorJobCost({ contractorInvoiceAmount: 800 })).toBe(800);
    expect(contractorJobCost({})).toBe(0);
  });

  it('is dated when the work was completed', () => {
    expect(contractorJobCostDate({ createdAt: t('2026-09-01T00:00:00Z'), workCompletedAt: t('2026-10-02T00:00:00Z') })?.toISOString())
      .toBe('2026-10-02T00:00:00.000Z');
    expect(contractorJobCostDate({ createdAt: t('2026-09-01T00:00:00Z') })?.toISOString()).toBe('2026-09-01T00:00:00.000Z');
  });
});

describe('MTBF', () => {
  it('is (window − downtime) / failures per failed machine, averaged', () => {
    const failures = new Map([['m1', 2], ['m2', 1]]);
    const downtime = new Map([['m1', 48], ['m2', 0]]);
    // m1: (720 − 48) / 2 / 24 = 14; m2: 720 / 1 / 24 = 30 → 22
    expect(mtbfDays(failures, downtime, 720)).toBe(22);
    expect(mtbfDays(new Map(), new Map(), 720)).toBe(0);
  });

  it('counts only the elapsed part of the current month', () => {
    expect(elapsedHoursInMonths(['2026-09'], now)).toBe(30 * 24);
    const partial = elapsedHoursInMonths(['2026-10'], now);
    expect(partial).toBeGreaterThan(0);
    expect(partial).toBeLessThan(31 * 24);
  });
});

describe('server copy', () => {
  it('agrees with the app on every definition', () => {
    const wo = { status: 'CLOSED', slaDeadline: t('2026-10-10T12:00:00Z'), actualEndTime: t('2026-10-10T13:00:00Z'),
      partsUsed: [{ totalCost: 10 }], technicianWorkLogs: [{ laborCost: 5 }], totalLaborCost: null };
    expect(server.woCost(wo)).toBe(woCost(wo));
    expect(server.woSlaOutcome(wo, now)).toBe(woSlaOutcome(wo, now));
    const job = { systemInvoiceAmount: 1500, totalPartsCost: 500, partsFromFactory: [{ totalCost: 100 }], workCompletedAt: t('2026-10-02T00:00:00Z') };
    expect(server.contractorJobCost(job)).toBe(contractorJobCost(job));
    expect(server.contractorJobCostDate(job).toISOString()).toBe(contractorJobCostDate(job)?.toISOString());
    const failures = new Map([['m1', 3]]);
    const downtime = new Map([['m1', 10]]);
    expect(server.mtbfDays(failures, downtime, 500)).toBe(mtbfDays(failures, downtime, 500));
  });
});
