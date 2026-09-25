import { describe, it, expect, vi } from 'vitest';
import type { StaffRequest } from '@/types/staffRequest';

vi.mock('@/store/authStore', () => ({ useAuthStore: () => undefined }));
vi.mock('@/lib/firebase', () => ({ db: {}, storage: {}, auth: {}, functions: {} }));

const { isExpiredClosed } = await import('../../modules/requests/components/RequestList');

const DAY = 24 * 60 * 60 * 1000;
const now = Date.UTC(2026, 8, 25);
const ts = (ms: number) => ({ toMillis: () => ms });
const req = (status: StaffRequest['status'], closedMsAgo: number | null) =>
  ({ status, closedAt: closedMsAgo == null ? null : ts(now - closedMsAgo), updatedAt: ts(now) }) as unknown as StaffRequest;

describe('isExpiredClosed', () => {
  it('keeps closed requests for 7 days', () => {
    expect(isExpiredClosed(req('closed', 6 * DAY), now)).toBe(false);
  });
  it('drops closed requests after 7 days', () => {
    expect(isExpiredClosed(req('closed', 8 * DAY), now)).toBe(true);
  });
  it('never drops open or answered requests', () => {
    expect(isExpiredClosed(req('open', 30 * DAY), now)).toBe(false);
    expect(isExpiredClosed(req('answered', 30 * DAY), now)).toBe(false);
  });
});
