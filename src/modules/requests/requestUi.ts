import type { TFunction } from 'i18next';
import type { Timestamp } from 'firebase/firestore';
import type { StaffRequestCategory, StaffRequestRecipientRole, StaffRequestStatus } from '@/types/staffRequest';

export const field =
  'w-full rounded-lg border border-[#1E3A5F] bg-[#0A1628] px-3 py-2 text-sm text-[#F0F4F8] outline-none focus:border-[#1A56DB]';
export const labelCls = 'block text-xs font-medium text-[#8BA3BF] mb-1';

/** Largest single attachment accepted, in bytes. */
export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;

const CATEGORY_FALLBACK: Record<StaffRequestCategory, string> = {
  personal: 'Personal',
  work: 'Work',
  service_letter: 'Service letter',
  record_access: 'Access to past WO / breakdown details',
  other: 'Other',
};
const RECIPIENT_FALLBACK: Record<StaffRequestRecipientRole, string> = {
  supervisor: 'My department supervisor',
  plant_manager: 'My plant manager',
  admin: 'Admin',
};
const STATUS_FALLBACK: Record<StaffRequestStatus, string> = {
  open: 'Open',
  answered: 'Answered',
  closed: 'Closed',
};
const ROLE_FALLBACK: Record<string, string> = {
  admin: 'Admin',
  plant_manager: 'Plant Manager',
  supervisor: 'Supervisor',
  technician: 'Technician',
  store_keeper: 'Store Keeper',
  hr_officer: 'HR Officer',
  trainee: 'Trainee',
  floor_operator: 'Operator',
  safety_officer: 'Safety Officer',
};

export function categoryLabel(c: StaffRequestCategory, t: TFunction): string {
  return t(`common.staffRequests.categories.${c}`, { defaultValue: CATEGORY_FALLBACK[c] ?? c });
}
export function recipientLabel(r: StaffRequestRecipientRole, t: TFunction): string {
  return t(`common.staffRequests.recipients.${r}`, { defaultValue: RECIPIENT_FALLBACK[r] ?? r });
}
export function statusLabel(s: StaffRequestStatus, t: TFunction): string {
  return t(`common.staffRequests.statuses.${s}`, { defaultValue: STATUS_FALLBACK[s] ?? s });
}
export function roleLabel(role: string, t: TFunction): string {
  return t(`common.staffRequests.roles.${role}`, { defaultValue: ROLE_FALLBACK[role] ?? role.replace(/_/g, ' ') });
}

export const STATUS_COLOR: Record<StaffRequestStatus, string> = {
  open: 'bg-[#F59E0B]/15 text-[#FBBF24]',
  answered: 'bg-[#1A56DB]/20 text-[#93C5FD]',
  closed: 'bg-[#10B981]/15 text-[#34D399]',
};

export function fmtTs(ts: Timestamp | null | undefined): string {
  const d = ts?.toDate?.();
  if (!d) return '';
  return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
