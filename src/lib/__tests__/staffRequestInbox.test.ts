import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import { canAddressRecipient, isFrontlineRequester, isVisibleToSupervisor } from '../staffRequestInbox';
import { recipientOptionsFor } from '@/types/staffRequest';

const nodeRequire = createRequire(import.meta.url);
const server = nodeRequire('../../../functions/src/requests/recipientRules.js');

const me = { userId: 'jammy', department: 'Manufacturing' };
const req = (over: Record<string, unknown>) => ({ recipientUserId: null, requesterRole: 'technician', department: 'Manufacturing', ...over }) as never;

describe('supervisor inbox visibility', () => {
  it('shows a request addressed to the supervisor, from anyone', () => {
    expect(isVisibleToSupervisor(req({ recipientUserId: 'jammy', requesterRole: 'supervisor', department: 'Packing' }), me)).toBe(true);
    expect(isVisibleToSupervisor(req({ recipientUserId: 'jammy', requesterRole: 'trainee' }), me)).toBe(true);
  });

  it('shows requests from the floor of the same department even when a colleague was named', () => {
    for (const role of ['technician', 'trainee', 'floor_operator']) {
      expect(isVisibleToSupervisor(req({ recipientUserId: 'colleague', requesterRole: role }), me)).toBe(true);
    }
    expect(isVisibleToSupervisor(req({ recipientUserId: 'colleague', department: ' manufacturing ' }), me)).toBe(true);
  });

  it('does not show another department\'s floor requests, or another supervisor\'s requests to someone else', () => {
    expect(isVisibleToSupervisor(req({ recipientUserId: 'colleague', department: 'Packing' }), me)).toBe(false);
    expect(isVisibleToSupervisor(req({ recipientUserId: 'colleague', requesterRole: 'supervisor', department: 'Manufacturing' }), me)).toBe(false);
  });

  it('keeps showing older unnamed role-group requests of the department', () => {
    expect(isVisibleToSupervisor(req({}), me)).toBe(true);
    expect(isVisibleToSupervisor(req({ department: 'Packing' }), me)).toBe(false);
    expect(isVisibleToSupervisor(req({ department: null }), me)).toBe(false);
  });

  it('knows the floor roles', () => {
    expect(isFrontlineRequester('technician')).toBe(true);
    expect(isFrontlineRequester('supervisor')).toBe(false);
    expect(isFrontlineRequester(undefined)).toBe(false);
  });
});

describe('who a sender may address', () => {
  const sup = { id: 's1', role: 'supervisor', plantId: 'p1', department: 'Manufacturing' };
  const tech = { id: 't1', role: 'technician', plantId: 'p1', department: 'Manufacturing' };
  const user = (id: string, role: string, plantId: string | null, department: string | null) => ({ id, role, plantId, department, status: 'active' });

  it('lets a supervisor write to supervisors of other departments in the same plant, but not other plants or themselves', () => {
    expect(canAddressRecipient(sup, user('s2', 'supervisor', 'p1', 'Packing'))).toBe(true);
    expect(canAddressRecipient(sup, user('s3', 'supervisor', 'p2', 'Packing'))).toBe(false);
    expect(canAddressRecipient(sup, user('s1', 'supervisor', 'p1', 'Manufacturing'))).toBe(false);
    expect(canAddressRecipient(sup, user('pm', 'plant_manager', 'p1', null))).toBe(true);
    expect(canAddressRecipient(sup, user('ad', 'admin', null, null))).toBe(true);
  });

  it('keeps a technician or trainee to the supervisors of their own department', () => {
    expect(canAddressRecipient(tech, user('s2', 'supervisor', 'p1', 'Manufacturing'))).toBe(true);
    expect(canAddressRecipient(tech, user('s2', 'supervisor', 'p1', 'Packing'))).toBe(false);
    expect(canAddressRecipient(tech, user('x', 'technician', 'p1', 'Manufacturing'))).toBe(false);
  });

  it('offers supervisors in the sender role list', () => {
    expect(recipientOptionsFor('supervisor')).toEqual(['supervisor', 'plant_manager', 'admin']);
    expect(recipientOptionsFor('technician')).toEqual(['supervisor', 'plant_manager', 'admin']);
    expect(recipientOptionsFor('plant_manager')).toEqual(['admin']);
  });

  it('is the same on the server as in the app', () => {
    const senders = [sup, tech, { id: 'pm', role: 'plant_manager', plantId: 'p1', department: null }, { id: 'tr', role: 'trainee', plantId: 'p1', department: 'Packing' }];
    const people = [
      user('s2', 'supervisor', 'p1', 'Packing'), user('s4', 'supervisor', 'p1', 'Manufacturing'), user('s3', 'supervisor', 'p2', 'Packing'),
      user('pm2', 'plant_manager', 'p1', null), user('pm3', 'plant_manager', 'p2', null), user('ad', 'admin', null, null),
      user('t2', 'technician', 'p1', 'Manufacturing'),
    ];
    for (const s of senders) {
      for (const u of people) {
        expect(server.canAddress(s, u)).toBe(canAddressRecipient(s, u));
      }
    }
    expect(server.canAddress(tech, { ...user('s2', 'supervisor', 'p1', 'Manufacturing'), status: 'inactive' })).toBe(false);
  });
});
