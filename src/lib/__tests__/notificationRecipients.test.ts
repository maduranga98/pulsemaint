import { describe, it, expect } from 'vitest';
import {
  isNotificationForUser,
  isNotificationInReaderScope,
  isNotificationUnreadBy,
  isNotificationVisibleTo,
  isOversightCopy,
  isOwnAction,
  notificationDisplayMessage,
  notificationLocationLabel,
  resolveRecipientRoles,
  roleLabel,
} from '../notifications/recipients';

describe('resolveRecipientRoles', () => {
  it('does not copy admin or plant_manager onto a role-targeted notification', () => {
    expect(resolveRecipientRoles(['supervisor'], [])).toEqual(['supervisor']);
  });

  it('does not copy the oversight roles onto a user-targeted notification either', () => {
    expect(resolveRecipientRoles([], ['user-1'])).toEqual([]);
  });

  it('keeps a role that was named explicitly, once', () => {
    expect(resolveRecipientRoles(['admin', 'store_keeper', 'admin'], [])).toEqual(['admin', 'store_keeper']);
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

  it('does not reach admin or plant_manager unless their role or id was named', () => {
    const n = { recipientRoles: resolveRecipientRoles(['store_keeper'], []), recipientUserIds: [] };
    expect(isNotificationForUser(n, 'admin', 'a-1')).toBe(false);
    expect(isNotificationForUser(n, 'plant_manager', 'pm-1')).toBe(false);
    expect(isNotificationForUser({ ...n, recipientRoles: ['store_keeper', 'admin'] }, 'admin', 'a-1')).toBe(true);
    expect(isNotificationForUser({ recipientRoles: [], recipientUserIds: ['pm-1'] }, 'plant_manager', 'pm-1')).toBe(true);
  });

  it('ignores the oversight copy that older notifications carry in recipientRoles', () => {
    const old = {
      recipientRoles: ['store_keeper', 'admin', 'plant_manager'],
      targetRoles: ['store_keeper'],
      recipientUserIds: [],
      targetUserIds: [],
    };
    expect(isNotificationForUser(old, 'store_keeper', 's-1')).toBe(true);
    expect(isNotificationForUser(old, 'admin', 'a-1')).toBe(false);
    expect(isNotificationForUser(old, 'plant_manager', 'pm-1')).toBe(false);
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

describe('isNotificationVisibleTo', () => {
  const raisedForSupervisor = {
    recipientRoles: ['supervisor'],
    targetRoles: ['supervisor'],
    targetUserIds: [] as string[],
    plantId: 'plant-a',
    department: 'Assembly',
  };

  it('keeps admin and plant manager out of notifications raised for other roles', () => {
    expect(isNotificationVisibleTo(raisedForSupervisor, 'admin', 'a-1')).toBe(false);
    expect(isNotificationVisibleTo(raisedForSupervisor, 'plant_manager', 'pm-1')).toBe(false);
    expect(isNotificationVisibleTo(raisedForSupervisor, 'supervisor', 's-1')).toBe(true);
  });

  it('shows an admin only what names the admin role or them', () => {
    const forAdmin = { ...raisedForSupervisor, targetRoles: ['admin'], recipientRoles: ['admin'] };
    expect(isNotificationVisibleTo(forAdmin, 'admin', 'a-1')).toBe(true);
    const byId = { ...raisedForSupervisor, targetRoles: [], recipientRoles: [], targetUserIds: ['a-1'], recipientUserIds: ['a-1'] };
    expect(isNotificationVisibleTo(byId, 'admin', 'a-1')).toBe(true);
    expect(isNotificationVisibleTo(byId, 'admin', 'a-2')).toBe(false);
  });

  it('shows a plant manager what names their role, only from their own plant', () => {
    const forPm = { ...raisedForSupervisor, targetRoles: ['plant_manager'], recipientRoles: ['plant_manager'] };
    const pmScope = { plantId: 'plant-a', department: null };
    expect(isNotificationVisibleTo(forPm, 'plant_manager', 'pm-1', pmScope)).toBe(true);
    expect(isNotificationVisibleTo({ ...forPm, plantId: 'plant-b' }, 'plant_manager', 'pm-1', pmScope)).toBe(false);
  });
});

describe('notificationLocationLabel', () => {
  const plants = new Map([['plant-a', 'Colombo Plant']]);

  it('names the plant and the department', () => {
    expect(notificationLocationLabel({ plantId: 'plant-a', department: 'Packing' }, plants)).toBe('Colombo Plant · Packing');
  });

  it('falls back to the department of the user who raised it', () => {
    expect(notificationLocationLabel({ plantId: 'plant-a', actorDepartment: 'Assembly' }, plants)).toBe('Colombo Plant · Assembly');
  });

  it('prefers the event’s own department', () => {
    expect(
      notificationLocationLabel({ plantId: 'plant-a', department: 'Packing', actorDepartment: 'Assembly' }, plants),
    ).toBe('Colombo Plant · Packing');
  });

  it('shows just what is known, or nothing', () => {
    expect(notificationLocationLabel({ plantId: 'plant-a' }, plants)).toBe('Colombo Plant');
    expect(notificationLocationLabel({ department: 'Packing' }, plants)).toBe('Packing');
    expect(notificationLocationLabel({}, plants)).toBe('');
    expect(notificationLocationLabel({ plantId: 'gone' }, plants)).toBe('');
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

describe('isNotificationInReaderScope', () => {
  const scope = { plantId: 'plant-a', department: 'Assembly' };

  it('hides another plant\'s notifications', () => {
    expect(isNotificationInReaderScope({ recipientRoles: ['supervisor'], plantId: 'plant-b' }, scope, 'u1')).toBe(false);
  });

  it('hides another department\'s notifications from department-scoped readers', () => {
    expect(
      isNotificationInReaderScope({ recipientRoles: ['supervisor'], plantId: 'plant-a', department: 'Paint' }, scope, 'u1'),
    ).toBe(false);
  });

  it('shows the reader\'s own plant and department', () => {
    expect(
      isNotificationInReaderScope({ recipientRoles: ['supervisor'], plantId: 'plant-a', department: 'Assembly' }, scope, 'u1'),
    ).toBe(true);
  });

  it('always shows notifications addressed to the reader by id', () => {
    expect(isNotificationInReaderScope({ recipientUserIds: ['u1'], plantId: 'plant-b' }, scope, 'u1')).toBe(true);
  });

  it('shows everything to an unscoped reader (admin on All Plants)', () => {
    expect(isNotificationInReaderScope({ plantId: 'plant-b' }, { plantId: null, department: null }, 'admin')).toBe(true);
  });

  it('keeps plant-less (company-wide / legacy) notifications visible', () => {
    expect(isNotificationInReaderScope({ recipientRoles: ['supervisor'] }, scope, 'u1')).toBe(true);
  });
});
