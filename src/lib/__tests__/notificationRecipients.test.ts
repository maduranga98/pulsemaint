import { describe, it, expect } from 'vitest';
import {
  OVERSIGHT_ROLES,
  isHiddenAdminAction,
  isNotificationForUser,
  isNotificationUnreadBy,
  isNotificationVisibleTo,
  isOversightCopy,
  isOwnAction,
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

describe('isOwnAction', () => {
  it('is true only for the person who performed the action', () => {
    const n = { actorUserId: 'pm-1' };
    expect(isOwnAction(n, 'pm-1')).toBe(true);
    expect(isOwnAction(n, 'pm-2')).toBe(false);
  });

  it('is false when the actor was never recorded', () => {
    expect(isOwnAction({}, 'pm-1')).toBe(false);
    expect(isOwnAction({ actorUserId: null }, 'pm-1')).toBe(false);
    expect(isOwnAction({ actorUserId: 'pm-1' }, undefined)).toBe(false);
  });
});

describe('isHiddenAdminAction / isNotificationVisibleTo', () => {
  const adminAction = {
    recipientRoles: resolveRecipientRoles(['hr_officer'], []),
    recipientUserIds: [],
    targetRoles: ['hr_officer'],
    targetUserIds: [],
    actorRole: 'admin',
    actorUserId: 'a-1',
  };

  it('keeps an admin action out of a plant manager’s bar', () => {
    expect(isHiddenAdminAction(adminAction, 'plant_manager', 'pm-1')).toBe(true);
    expect(isNotificationVisibleTo(adminAction, 'plant_manager', 'pm-1')).toBe(false);
  });

  it('still shows admins their own and other admins’ actions', () => {
    expect(isHiddenAdminAction(adminAction, 'admin', 'a-2')).toBe(false);
    expect(isNotificationVisibleTo(adminAction, 'admin', 'a-2')).toBe(true);
    expect(isNotificationVisibleTo(adminAction, 'admin', 'a-1')).toBe(true);
  });

  it('shows an admin action that names the plant manager’s role', () => {
    const n = { ...adminAction, targetRoles: ['plant_manager'] };
    expect(isHiddenAdminAction(n, 'plant_manager', 'pm-1')).toBe(false);
    expect(isNotificationVisibleTo(n, 'plant_manager', 'pm-1')).toBe(true);
  });

  it('shows an admin action raised for the plant manager by id', () => {
    const n = { ...adminAction, targetRoles: [], targetUserIds: ['pm-1'] };
    expect(isHiddenAdminAction(n, 'plant_manager', 'pm-1')).toBe(false);
  });

  it('leaves every other role’s targeting untouched', () => {
    expect(isNotificationVisibleTo(adminAction, 'hr_officer', 'hr-1')).toBe(true);
    expect(isNotificationVisibleTo(adminAction, 'technician', 't-1')).toBe(false);
  });

  it('does not hide non-admin actions from a plant manager', () => {
    const n = { ...adminAction, actorRole: 'supervisor', actorUserId: 's-1' };
    expect(isHiddenAdminAction(n, 'plant_manager', 'pm-1')).toBe(false);
    expect(isNotificationVisibleTo(n, 'plant_manager', 'pm-1')).toBe(true);
  });
});

describe('notificationDisplayMessage', () => {
  const base = {
    message: "You've been assigned a new training module: Electrical Trainee Orientation",
    oversightMessage: 'assigned "Electrical Trainee Orientation" to Julia Perera',
    actorName: 'Chamathka Perera',
    actorRole: 'plant_manager',
    actorUserId: 'pm-1',
    targetRoles: [],
    targetUserIds: ['trainee-1'],
  };

  it('attributes the action with name and role for an oversight reader', () => {
    expect(notificationDisplayMessage(base, 'admin', 'a-1')).toBe(
      'Chamathka Perera (Plant Manager) — assigned "Electrical Trainee Orientation" to Julia Perera',
    );
  });

  it('addresses the actor in the second person when they did it themselves', () => {
    expect(notificationDisplayMessage(base, 'plant_manager', 'pm-1')).toBe(
      'You assigned "Electrical Trainee Orientation" to Julia Perera',
    );
  });

  it('rewrites the actor’s name as "you" when no oversight phrasing exists', () => {
    const n = {
      ...base,
      oversightMessage: null,
      message: 'New parts request from Chamathka Perera',
    };
    expect(notificationDisplayMessage(n, 'plant_manager', 'pm-1')).toBe('New parts request from you');
  });

  it('capitalises a leading name when rewriting it', () => {
    const n = {
      ...base,
      oversightMessage: null,
      message: 'Chamathka Perera signed off work order WO-1024',
    };
    expect(notificationDisplayMessage(n, 'plant_manager', 'pm-1')).toBe(
      'You signed off work order WO-1024',
    );
  });

  it('attributes another role’s action to an oversight reader whose role was targeted', () => {
    // The plant manager's role is named on the notification, but the action is
    // someone else's — it reads as "Name (Role) — did X" rather than as a
    // message addressed to them.
    const n = {
      message: 'CNC Machine 04: new critical breakdown reported by Nuwan Silva',
      oversightMessage: 'reported a new critical breakdown on CNC Machine 04',
      actorName: 'Nuwan Silva',
      actorRole: 'supervisor',
      actorUserId: 's-1',
      targetRoles: ['supervisor', 'plant_manager', 'admin'],
      targetUserIds: [],
    };
    expect(notificationDisplayMessage(n, 'plant_manager', 'pm-1')).toBe(
      'Nuwan Silva (Supervisor) — reported a new critical breakdown on CNC Machine 04',
    );
  });

  it('keeps the stored wording when an oversight reader was named personally', () => {
    const n = {
      message: 'A service letter ("Promotion") has been issued for you by Ayesha Fernando',
      oversightMessage: 'issued a service letter ("Promotion") for Chamathka Perera',
      actorName: 'Ayesha Fernando',
      actorRole: 'hr_officer',
      actorUserId: 'hr-1',
      targetRoles: [],
      targetUserIds: ['pm-1'],
    };
    expect(notificationDisplayMessage(n, 'plant_manager', 'pm-1')).toBe(n.message);
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
