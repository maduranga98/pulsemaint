import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/firebase', () => ({ db: {}, storage: {}, auth: {}, functions: {} }));
vi.mock('../../lib/firebase', () => ({ db: {}, storage: {}, auth: {}, functions: {} }));
vi.mock('../../store/authStore', () => ({ useAuthStore: { getState: () => ({ userProfile: null }) } }));

const { buildMonthlyAnalytics } = await import('../../services/analyticsAggregation');
// generateMonthlyAnalytics (analytics_monthly, scheduled executive reports) must match the dashboards.
// @ts-expect-error -- CommonJS Cloud Functions module, no type declarations
const server = (await import('../../../functions/src/analytics/monthlyAnalytics.js')).default;

const t = (iso: string) => new Date(iso);
const now = t('2026-10-15T12:00:00Z');

const machines = [
  { id: 'm1', name: 'Press 1', costPerHourDown: 1000 },
  { id: 'm2', name: 'Lathe', unitsPerHour: 10, unitValue: 50 },
  { id: 'm3', name: 'Mixer' },
];
const breakdowns = [
  { id: 'b1', machineId: 'm1', machineName: 'Press 1', status: 'closed', severity: 'critical', type: 'mechanical',
    machineDepartment: 'Stamping', reportedAt: t('2026-09-10T08:00:00Z'), linkedWOId: 'w1' },
  { id: 'b2', machineId: 'm1', machineName: 'Press 1', status: 'closed', severity: 'high', type: 'electrical',
    machineDepartment: 'Stamping', reportedAt: t('2026-09-18T08:00:00Z'), closedAt: t('2026-09-18T12:00:00Z') },
  { id: 'b3', machineId: 'm2', machineName: 'Lathe', status: 'cancelled', severity: 'low', reportedAt: t('2026-09-12T08:00:00Z') },
  { id: 'b4', machineId: 'm2', machineName: 'Lathe', status: 'assigned', severity: 'medium', reportedAt: t('2026-09-25T08:00:00Z'), linkedWOId: 'w5' },
  { id: 'b5', machineId: 'm3', machineName: 'Mixer', status: 'closed', severity: 'low', reportedAt: t('2026-08-20T08:00:00Z') },
];
const workOrders = [
  { id: 'w1', machineId: 'm1', machineName: 'Press 1', woType: 'BREAKDOWN', status: 'CLOSED', priority: 'critical', linkedBreakdownId: 'b1',
    createdAt: t('2026-09-10T08:30:00Z'), actualStartTime: t('2026-09-10T09:00:00Z'), actualEndTime: t('2026-09-10T15:00:00Z'),
    supervisorSignOffAt: t('2026-09-10T16:00:00Z'), slaDeadline: t('2026-09-10T14:00:00Z'), signOffOutcome: 'complete',
    partsUsed: [{ totalCost: 2000 }], totalLaborCost: 600, assignedTechnicianIds: ['u1'], assignedTechnicianNames: ['Nimal'], totalDurationMinutes: 360 },
  { id: 'w2', machineId: 'm3', machineName: 'Mixer', woType: 'PREVENTIVE', status: 'CLOSED', priority: 'medium',
    createdAt: t('2026-09-05T06:00:00Z'), actualStartTime: t('2026-09-05T07:00:00Z'), actualEndTime: t('2026-09-05T09:00:00Z'),
    supervisorSignOffAt: t('2026-09-05T10:00:00Z'), slaDeadline: t('2026-09-05T23:59:59Z'),
    partsUsed: [{ totalCost: 300 }], technicianWorkLogs: [{ laborCost: 120 }], assignedTechnicianIds: ['u2'], assignedTechnicianNames: ['Kamal'] },
  { id: 'w3', machineId: 'm2', machineName: 'Lathe', woType: 'CORRECTIVE', status: 'CANCELLED', createdAt: t('2026-09-07T06:00:00Z'),
    partsUsed: [{ totalCost: 999 }], slaDeadline: t('2026-09-08T00:00:00Z') },
  { id: 'w4', machineId: 'm2', machineName: 'Lathe', woType: 'CONTRACTOR', status: 'CLOSED', priority: 'high',
    createdAt: t('2026-09-14T06:00:00Z'), actualStartTime: t('2026-09-14T07:00:00Z'), actualEndTime: t('2026-09-14T11:00:00Z'),
    supervisorSignOffAt: t('2026-09-14T12:00:00Z'), partsUsed: [{ totalCost: 400 }] },
  // Failed sign-off: b4 stays down.
  { id: 'w5', machineId: 'm2', machineName: 'Lathe', woType: 'BREAKDOWN', status: 'CLOSED', priority: 'medium', linkedBreakdownId: 'b4',
    createdAt: t('2026-09-25T09:00:00Z'), actualStartTime: t('2026-09-25T10:00:00Z'), actualEndTime: t('2026-09-25T12:00:00Z'),
    supervisorSignOffAt: t('2026-09-25T13:00:00Z'), signOffOutcome: 'failed', slaDeadline: t('2026-09-26T00:00:00Z') },
];
const contractorJobs = [
  { id: 'c1', workOrderId: 'w4', machineId: 'm2', machineName: 'Lathe', contractorId: 'k1', contractorName: 'Acme', status: 'signed_off',
    projectCost: 5000, totalPartsCost: 400, totalProjectCost: 5400, systemInvoiceAmount: 5400,
    workCompletedAt: t('2026-09-14T11:00:00Z'), signedOffAt: t('2026-09-14T12:30:00Z'), rating: { overallScore: 4 } },
  { id: 'c2', contractorId: 'k1', contractorName: 'Acme', status: 'cancelled', systemInvoiceAmount: 7000, createdAt: t('2026-09-16T00:00:00Z') },
];
const pmHistory = [
  { id: 'p1', machineId: 'm3', status: 'completed_on_time', dueDate: t('2026-09-05T00:00:00Z'), completedDate: t('2026-09-05T09:00:00Z') },
  { id: 'p2', machineId: 'm3', status: 'missed', dueDate: t('2026-09-12T00:00:00Z') },
  { id: 'p3', machineId: 'm1', status: 'in_progress', dueDate: t('2026-09-28T00:00:00Z') },
  { id: 'p4', machineId: 'm1', status: 'completed_late', dueDate: t('2026-09-20T00:00:00Z'), completedDate: t('2026-09-22T00:00:00Z') },
];

describe('monthly analytics — server copy', () => {
  it('produces the dashboards’ figures for a month', () => {
    const raw = { breakdowns, workOrders, contractorJobs, pmHistory, machines };
    const { updatedAt: _u, incompleteSources: _i, ...app } = buildMonthlyAnalytics('co1', '2026-09', raw, now);
    const fromServer = server.buildMonthlyAnalytics('co1', '2026-09', raw, { timeZone: 'UTC', now });
    expect(fromServer).toEqual(app);

    // A few of the definitions, spelled out.
    expect(app.totalBreakdowns).toBe(3); // cancelled b3 and August's b5 left out
    // WO parts + labour (cancelled w3 out) + the contractor's own charge (5000, not 5400 — w4's parts counted once)
    expect(app.totalMaintenanceCost).toBe(2000 + 600 + 300 + 120 + 400 + 5000);
    // SLA: w1 breached (done 15:00 > 14:00), w2 met, w5 met; cancelled w3 not evaluated
    expect([app.slaMet, app.slaBreached]).toEqual([2, 1]);
    // PM: on time / everything due in September that isn't still in progress (p3 is overdue → missed)
    expect(app.pmCompletedOnTime).toBe(1);
    expect(app.pmMissed).toBe(2);
    expect(app.pmComplianceRate).toBe(25);
  });
});
