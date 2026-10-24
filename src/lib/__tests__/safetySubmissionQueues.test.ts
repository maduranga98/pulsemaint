import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { getAssignmentQueue, getInviteQueue } from '../safety/submissionQueues';

const NOW = Date.UTC(2026, 9, 24);
const DAY = 86400000;
const ts = (ms: number) => ({ toMillis: () => ms });

const invite = (over: Record<string, unknown> = {}): any => ({
  id: 'i1', status: 'assigned', attemptsUsed: 0, maxAttempts: 3, hasQuiz: true, passingScore: 70, latestScore: null,
  attempts: [], dueAt: ts(NOW + 5 * DAY), ...over,
});
const card = (over: Record<string, unknown> = {}): any => ({ status: 'active', validUntil: ts(NOW + 100 * DAY), ...over });

describe('getInviteQueue', () => {
  it('a passing submission waits for review and sign-off', () => {
    expect(getInviteQueue(invite({ status: 'submitted', attemptsUsed: 1, latestScore: 90 }), null, NOW)).toBe('toSignoff');
  });
  it('a signed-off invite without a card is still "to sign off" (export the card)', () => {
    expect(getInviteQueue(invite({ status: 'signed_off' }), null, NOW)).toBe('toSignoff');
  });
  it('a signed-off invite with a valid card needs nothing', () => {
    expect(getInviteQueue(invite({ status: 'signed_off' }), card(), NOW)).toBeNull();
  });
  it('a card whose period ended (or was revoked) is expired', () => {
    expect(getInviteQueue(invite({ status: 'signed_off' }), card({ validUntil: ts(NOW - DAY) }), NOW)).toBe('expired');
    expect(getInviteQueue(invite({ status: 'signed_off' }), card({ status: 'revoked' }), NOW)).toBe('expired');
  });
  it('a failed final attempt, a passed due date or used-up attempts can be reassigned', () => {
    expect(getInviteQueue(invite({ status: 'submitted', attemptsUsed: 1, latestScore: 40 }), null, NOW)).toBe('reassignable');
    expect(getInviteQueue(invite({ dueAt: ts(NOW - DAY) }), null, NOW)).toBe('reassignable');
    expect(getInviteQueue(invite({ attemptsUsed: 3 }), null, NOW)).toBe('reassignable');
  });
  it('waiting on the person, or already replaced, is in no queue', () => {
    expect(getInviteQueue(invite(), null, NOW)).toBeNull();
    expect(getInviteQueue(invite({ status: 'reassigned' }), null, NOW)).toBeNull();
  });
});

describe('getAssignmentQueue (company staff)', () => {
  const a = (over: Record<string, unknown>): any => ({ status: 'in_progress', dueDate: null, certificateExpiryDate: null, ...over });
  it('maps statuses to the three queues', () => {
    expect(getAssignmentQueue(a({ status: 'awaiting_practical' }), NOW)).toBe('toSignoff');
    expect(getAssignmentQueue(a({ status: 'quiz_passed' }), NOW)).toBe('toSignoff');
    expect(getAssignmentQueue(a({ status: 'quiz_failed' }), NOW)).toBe('reassignable');
    expect(getAssignmentQueue(a({ status: 'retraining_required' }), NOW)).toBe('reassignable');
    expect(getAssignmentQueue(a({ status: 'expired' }), NOW)).toBe('expired');
    expect(getAssignmentQueue(a({ status: 'certified', certificateExpiryDate: ts(NOW - DAY) }), NOW)).toBe('expired');
    expect(getAssignmentQueue(a({ status: 'certified', certificateExpiryDate: ts(NOW + DAY) }), NOW)).toBeNull();
    expect(getAssignmentQueue(a({ status: 'in_progress', dueDate: ts(NOW - DAY) }), NOW)).toBe('reassignable');
    expect(getAssignmentQueue(a({ status: 'in_progress', dueDate: ts(NOW + DAY) }), NOW)).toBeNull();
  });
});

describe('renewal clean-up', () => {
  const { supersededInviteIds, inviteFilePaths } = createRequire(import.meta.url)('../../../functions/src/safetyTraining/renewalLogic.js');
  const base = { companyId: 'A', contractorId: 'c1', technicianId: 't1', moduleId: 'm1' };
  const mk = (id: string, assignedMs: number, over: Record<string, unknown> = {}) => ({ id, data: { ...base, assignedAt: ts(assignedMs), ...over } });

  it('removes only earlier invites of the same person and training', () => {
    const renewed = mk('new', 1000);
    const others = [
      mk('old1', 100), mk('old2', 200, { status: 'signed_off' }),
      mk('newer', 2000), // assigned later: not superseded
      mk('otherModule', 100, { moduleId: 'm2' }),
      mk('otherPerson', 100, { technicianId: 't2' }),
      mk('otherCompany', 100, { companyId: 'B' }),
      renewed,
    ];
    expect(supersededInviteIds(renewed, others).sort()).toEqual(['old1', 'old2']);
  });
  it('lists every uploaded file of an invite', () => {
    expect(inviteFilePaths({ attempts: [{ attachments: [{ path: 'a/1.jpg' }, {}] }, { attachments: [{ path: 'a/2.m4a' }] }] })).toEqual(['a/1.jpg', 'a/2.m4a']);
    expect(inviteFilePaths({})).toEqual([]);
  });
});
