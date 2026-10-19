import { describe, it, expect } from 'vitest';
import {
  breakdownBucket,
  computeBusyTechnicians,
  isHiddenFromOthers,
  isSelfAttended,
  type BusyTicket,
  type BusyWorkOrder,
} from '../breakdownWorkflow';

const none = { attendedBy: null, assignedBy: null };

describe('breakdownBucket', () => {
  it('keeps unattended reports in Reported', () => {
    expect(breakdownBucket({ status: 'reported', ...none })).toBe('reported');
  });

  it('puts a supervisor-assigned ticket in Assigned', () => {
    expect(breakdownBucket({ status: 'assigned', attendedBy: 't1', assignedBy: 's1' })).toBe('assigned');
  });

  it('puts a self-attended ticket straight into Open', () => {
    const b = { status: 'assigned' as const, attendedBy: 't1', assignedBy: null };
    expect(isSelfAttended(b)).toBe(true);
    expect(breakdownBucket(b)).toBe('open');
  });

  it('puts in-flight and resolved (awaiting sign-off) tickets in Open', () => {
    expect(breakdownBucket({ status: 'repair_in_progress', attendedBy: 't1', assignedBy: 's1' })).toBe('open');
    expect(breakdownBucket({ status: 'resolved', attendedBy: 't1', assignedBy: null })).toBe('open');
  });

  it('puts closed and cancelled tickets in Closed', () => {
    expect(breakdownBucket({ status: 'closed', ...none })).toBe('closed');
    expect(breakdownBucket({ status: 'cancelled', ...none })).toBe('closed');
  });
});

describe('isHiddenFromOthers', () => {
  const ticket = { attendedBy: 't1', assignedTechnicianIds: ['t1', 't3'] };

  it('hides an attended ticket from other technicians and trainees', () => {
    expect(isHiddenFromOthers(ticket, 'technician', 't2')).toBe(true);
    expect(isHiddenFromOthers(ticket, 'trainee', 't2')).toBe(true);
  });

  it('shows it to the attender and to anyone assigned alongside', () => {
    expect(isHiddenFromOthers(ticket, 'technician', 't1')).toBe(false);
    expect(isHiddenFromOthers(ticket, 'technician', 't3')).toBe(false);
  });

  it('never hides it from supervisors and above', () => {
    for (const role of ['supervisor', 'plant_manager', 'admin', 'store_keeper']) {
      expect(isHiddenFromOthers(ticket, role, 'u9')).toBe(false);
    }
  });

  it('does not hide unattended tickets', () => {
    expect(isHiddenFromOthers({ attendedBy: null, assignedTechnicianIds: [] }, 'technician', 't2')).toBe(false);
  });
});

describe('computeBusyTechnicians', () => {
  const ticket = (over: Partial<BusyTicket> = {}): BusyTicket => ({
    id: 'b1',
    ticketNumber: 'BD-1',
    status: 'assigned',
    attendedBy: 't1',
    severity: null,
    linkedWOId: null,
    machineId: 'm1',
    machineName: 'Press',
    ...over,
  });

  it('marks a technician attending an unsubmitted breakdown as busy', () => {
    const busy = computeBusyTechnicians([], [ticket()]);
    expect(busy.get('t1')).toMatchObject({ kind: 'breakdown', ref: 'BD-1' });
  });

  it('frees them once the assessment is submitted, resolved, or handed to a WO', () => {
    expect(computeBusyTechnicians([], [ticket({ severity: 'low' })]).size).toBe(0);
    expect(computeBusyTechnicians([], [ticket({ status: 'resolved' })]).size).toBe(0);
    expect(computeBusyTechnicians([], [ticket({ linkedWOId: 'wo1' })]).size).toBe(0);
  });

  it('ignores the ticket a work order is being created for', () => {
    expect(computeBusyTechnicians([], [ticket()], { ignoreBreakdownIds: ['b1'] }).size).toBe(0);
  });

  it('does not block more work on the machine they are already on', () => {
    expect(computeBusyTechnicians([], [ticket()], { allowMachineId: 'm1' }).size).toBe(0);
    expect(computeBusyTechnicians([], [ticket()], { allowMachineId: 'm2' }).size).toBe(1);
  });

  const wo = (over: Partial<BusyWorkOrder> = {}): BusyWorkOrder => ({
    woNumber: 'WO-7',
    status: 'IN_PROGRESS',
    machineId: 'm2',
    assignedTechnicianIds: ['t1', 't2'],
    ...over,
  });

  it('marks every assignee of an in-progress WO without per-person state', () => {
    const busy = computeBusyTechnicians([wo()], []);
    expect([...busy.keys()].sort()).toEqual(['t1', 't2']);
    expect(busy.get('t1')).toMatchObject({ kind: 'work_order', ref: 'WO-7' });
  });

  it('only marks the people who started when the WO tracks per-person state', () => {
    const busy = computeBusyTechnicians(
      [wo({ assigneeStates: [{ technicianId: 't1', status: 'IN_PROGRESS' }] })],
      [],
    );
    expect([...busy.keys()]).toEqual(['t1']);
  });

  it('frees an assignee who has submitted their own completion', () => {
    const busy = computeBusyTechnicians([wo({ assigneeCompletions: [{ technicianId: 't2' }] })], []);
    expect([...busy.keys()]).toEqual(['t1']);
  });

  it('ignores work orders that have not started or are finished', () => {
    for (const status of ['OPEN', 'ASSIGNED', 'COMPLETED', 'SIGNED_OFF', 'CLOSED']) {
      expect(computeBusyTechnicians([wo({ status })], []).size).toBe(0);
    }
  });

  it('keeps technicians on hold busy — the job is still theirs', () => {
    expect(computeBusyTechnicians([wo({ status: 'ON_HOLD_PARTS' })], []).size).toBe(2);
  });
});
