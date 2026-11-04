// Who sees which staff request in the Requests Inbox (supervisors), and who a requester may address.
// Pure so it can be tested; the Inbox page, the subscription and the recipient picker use it.
//
// A supervisor's inbox shows, within their own plant:
//  - a request addressed to them by name (from anyone: a technician, a trainee, a floor operator, or a
//    supervisor of another department in the same plant);
//  - a request from a technician, trainee or floor operator of their own department that was sent to a
//    supervisor — even when a colleague supervisor was the one named, so nothing from the floor goes unseen;
//  - an older role-group request (no named person) from their department.

import { sameDepartment } from '@/hooks/useRecordPlantMatcher';
import type { StaffRequest } from '@/types/staffRequest';

/** Roles that raise requests to their own department's supervisors. */
export const FRONTLINE_REQUESTER_ROLES = ['technician', 'trainee', 'floor_operator'] as const;

export function isFrontlineRequester(role: string | null | undefined): boolean {
  return (FRONTLINE_REQUESTER_ROLES as readonly string[]).includes(role ?? '');
}

type InboxRequest = Pick<StaffRequest, 'recipientUserId' | 'requesterRole' | 'department'>;

export function isVisibleToSupervisor(
  r: InboxRequest,
  me: { userId: string; department: string | null | undefined },
): boolean {
  if (r.recipientUserId === me.userId) return true;
  if (r.recipientUserId) {
    // Named colleague: still shown for requests from the floor of my own department.
    return isFrontlineRequester(r.requesterRole) && sameDepartment(r.department, me.department);
  }
  return sameDepartment(r.department, me.department);
}

/** A person a requester may address in the picker (mirrors functions/src/requests/recipientRules.js). */
export interface RecipientCandidate {
  id: string;
  role: string;
  plantId: string | null;
  department: string | null;
}

export function canAddressRecipient(
  me: { id: string; role: string; plantId: string | null; department: string | null },
  u: RecipientCandidate,
): boolean {
  if (u.id === me.id) return false;
  if (u.role === 'admin') return me.role !== 'admin';
  if ((u.plantId ?? null) !== (me.plantId ?? null)) return false;
  if (u.role === 'plant_manager') return me.role !== 'plant_manager';
  if (u.role !== 'supervisor') return false;
  // A supervisor can write to supervisors of any department in the plant; everyone else to their own department's.
  return me.role === 'supervisor' || sameDepartment(u.department, me.department);
}
