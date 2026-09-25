import type { Timestamp } from 'firebase/firestore';

/** What the request is about. */
export type StaffRequestCategory =
  | 'personal'
  | 'work'
  | 'service_letter'
  | 'record_access'
  | 'other';

export const STAFF_REQUEST_CATEGORIES: StaffRequestCategory[] = [
  'personal',
  'work',
  'service_letter',
  'record_access',
  'other',
];

/**
 * Who a request is routed to. Requests go to a role group rather than a named
 * person, scoped by the requester's own plant/department:
 * - supervisor: supervisors of the requester's plant AND department
 * - plant_manager: plant managers of the requester's plant
 * - admin: the company's admins
 */
export type StaffRequestRecipientRole = 'supervisor' | 'plant_manager' | 'admin';

export type StaffRequestStatus = 'open' | 'answered' | 'closed';

export interface StaffRequestAttachment {
  id: string;
  name: string;
  url: string;
  storagePath: string;
  size: number;
  contentType: string;
}

export interface StaffRequestReply {
  id: string;
  authorId: string;
  authorName: string;
  authorRole: string;
  message: string;
  attachments: StaffRequestAttachment[];
  createdAt: Timestamp;
}

export interface StaffRequest {
  id: string;
  companyId: string;
  plantId: string | null;
  department: string | null;

  requesterId: string;
  requesterName: string;
  requesterRole: string;

  category: StaffRequestCategory;
  subject: string;
  message: string;
  /** For record_access: the WO / breakdown number the requester wants to see. */
  reference: string | null;
  attachments: StaffRequestAttachment[];

  recipientRole: StaffRequestRecipientRole;

  status: StaffRequestStatus;
  replies: StaffRequestReply[];

  createdAt: Timestamp;
  updatedAt: Timestamp;
  closedAt: Timestamp | null;
}

/** Recipients each role may address. Admin doesn't raise requests at all. */
export function recipientOptionsFor(role: string | undefined): StaffRequestRecipientRole[] {
  if (!role || role === 'admin') return [];
  if (role === 'plant_manager') return ['admin'];
  if (role === 'supervisor') return ['plant_manager', 'admin'];
  return ['supervisor', 'plant_manager', 'admin'];
}

/** Roles that have a Requests Inbox. */
export const REQUEST_HANDLER_ROLES: StaffRequestRecipientRole[] = ['supervisor', 'plant_manager', 'admin'];
