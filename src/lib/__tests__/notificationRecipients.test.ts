import { describe, it, expect } from 'vitest';
import {
  OVERSIGHT_ROLES,
  isNotificationForUser,
  isNotificationUnreadBy,
  isOversightCopy,
  notificationDisplayMessage,
  resolveRecipientRoles,
  roleLabel,
} from '../notifications/recipients';

describe('resolveRecipientRoles', () => {
  it('copies admin and plant_manager onto a role-targeted notification', () => {
    const roles = resolveRecipientRoles(['supervisor'], []);
    expect(roles).toContain('supervisor');
    expect(roles).toContain('admin');
    expect(roles).toContain('plant_manager');
  });

  it('copies the oversight roles onto a user-targeted notification too', () => {
    const roles = resolveRecipientRoles([], ['user-1']);
    expect(roles).toEqual(expect.arrayContaining(OVERSIGHT_ROLES));
  });

  it('does not duplicate a role that was already targeted', () => {
    const roles = resolveRecipientRoles(['admin', 'store_keeper'], []);
    expect(roles.filter((r) => r === 'admin')).toHaveLength(1);
    expect(new Set(roles).size).toBe(roles.length);
  });

  it('leaves a broadcast as a broadcast', () => {
    // No roles and no users means "everyone"; adding the oversight roles
    // would narrow it to just those two.
    expect(resolveRecipientRoles([], [])).toEqual([]);
  });
});

describe('isNotificationForUser', () => {
  it('shows a role-targeted notification only to that role', () => {
    const n = { recipientRoles: ['store_keeper' as const], recipientUserIds: [] };
    expect(isNotificationForUser(n, 'store_keeper', 'u-1')).toBe(true);
    expect(isNotificationForUser(n, 'technician', 'u-2')).toBe(false);
    expect(isNotificationForUser(n, 'hr_officer', 'u-3')).toBe(false);
  });

  it('shows a user-targeted notification only to that user', () => {
    const n = { recipientRoles: [], recipientUserIds: ['u-1'] };
    expect(isNotificationForUser(n, 'technician', 'u-1')).toBe(true);
    expect(isNotificationForUser(n, 'technician', 'u-2')).toBe(false);
  });

  it('reaches the oversight roles because they are written onto every targeted notification', () => {
    const roles = resolveRecipientRoles(['store_keeper'], []);
    const n = { recipientRoles: roles, recipientUserIds: [] };
    expect(isNotificationForUser(n, 'admin', 'a-1')).toBe(true);
    expect(isNotificationForUser(n, 'plant_manager', 'pm-1')).toBe(true);
    expect(isNotificationForUser(n, 'technician', 't-1')).toBe(false);
  });

  it('routes an untargeted legacy notification to the oversight roles only', () => {
    const n = {};
    expect(isNotificationForUser(n, 'admin', 'a-1')).toBe(true);
    expect(isNotificationForUser(n, 'plant_manager', 'pm-1')).toBe(true);
    expect(isNotificationForUser(n, 'supervisor', 's-1')).toBe(false);
  });
});

describe('isNotificationUnreadBy', () => {
  it('drops a notification the user has already read', () => {
    expect(isNotificationUnreadBy({ readBy: ['u-1'] }, 'u-1')).toBe(false);
  });

  it('keeps it for everyone else', () => {
    expect(isNotificationUnreadBy({ readBy: ['u-1'] }, 'u-2')).toBe(true);
  });

  it('treats a missing readBy as unread', () => {
    expect(isNotificationUnreadBy({}, 'u-1')).toBe(true);
    expect(isNotificationUnreadBy({ readBy: null }, 'u-1')).toBe(true);
  });
});

describe('isOversightCopy', () => {
  const traineeTargeted = { targetRoles: [], targetUserIds: ['trainee-1'] };

  it('is true for a plant manager reading a trainee-targeted notification', () => {
    expect(isOversightCopy(traineeTargeted, 'plant_manager', 'pm-1')).toBe(true);
    expect(isOversightCopy(traineeTargeted, 'admin', 'a-1')).toBe(true);
  });

  it('is false for the person it was raised for', () => {
    expect(isOversightCopy(traineeTargeted, 'trainee', 'trainee-1')).toBe(false);
  });

  it('is false for an oversight role that was itself a target', () => {
    const targeted = { targetRoles: ['plant_manager'], targetUserIds: [] };
    expect(isOversightCopy(targeted, 'plant_manager', 'pm-1')).toBe(false);
  });

  it('is false for an oversight user targeted by id', () => {
    const targeted = { targetRoles: [], targetUserIds: ['pm-1'] };
    expect(isOversightCopy(targeted, 'plant_manager', 'pm-1')).toBe(false);
  });

  it('is false for non-oversight roles regardless of targeting', () => {
    expect(isOversightCopy(traineeTargeted, 'supervisor', 's-1')).toBe(false);
  });

  it('leaves legacy notifications with no recorded target alone', () => {
    expect(isOversightCopy({}, 'plant_manager', 'pm-1')).toBe(false);
  });
});

describe('notificationDisplayMessage', () => {
  const base = {
    message: "You've been assigned a new training module: Electrical Trainee Orientation",
    oversightMessage: 'assigned "Electrical Trainee Orientation" to Julia Perera',
    actorName: 'Chamathka Perera',
    actorRole: 'plant_manager',
    targetRoles: [],
    targetUserIds: ['trainee-1'],
  };

  it('attributes the action with name and role for an oversight reader', () => {
    expect(notificationDisplayMessage(base, 'admin', 'a-1')).toBe(
      'Chamathka Perera (Plant Manager) — assigned "Electrical Trainee Orientation" to Julia Perera',
    );
  });

  it('leaves the original wording for the person it was raised for', () => {
    expect(notificationDisplayMessage(base, 'trainee', 'trainee-1')).toBe(base.message);
  });

  it('falls back to the original message when no oversight phrasing was supplied', () => {
    const n = { ...base, oversightMessage: null };
    expect(notificationDisplayMessage(n, 'admin', 'a-1')).toBe(`Chamathka Perera (Plant Manager) — ${base.message}`);
  });

  it('drops the attribution prefix when the actor is unknown', () => {
    const n = { ...base, actorName: null };
    expect(notificationDisplayMessage(n, 'admin', 'a-1')).toBe(base.oversightMessage);
  });

  it('uses the raw role when it has no friendly label', () => {
    expect(roleLabel('maintenance_supervisor')).toBe('maintenance supervisor');
    expect(roleLabel(undefined)).toBe('');
  });
});
