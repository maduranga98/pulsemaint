import { describe, it, expect } from 'vitest';
import { OVERSIGHT_ROLES, resolveRecipientRoles } from '../notifications/recipients';

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
