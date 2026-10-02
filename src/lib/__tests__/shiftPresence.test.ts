import { describe, it, expect } from 'vitest';
import { isCurrentShiftSession, presentUserIds, STALE_SESSION_MS } from '../shiftPresence';

const NOW = new Date('2026-09-25T10:00:00Z').getTime();
const session = (userId: string, hoursAgo: number, status: 'active' | 'completed' = 'active') => ({
  userId,
  status,
  actualStart: new Date(NOW - hoursAgo * 60 * 60 * 1000),
});

describe('isCurrentShiftSession', () => {
  it('counts a session started within the window', () => {
    expect(isCurrentShiftSession(session('a', 9), NOW)).toBe(true);
  });

  it('drops a forgotten clock-out older than the window', () => {
    expect(isCurrentShiftSession(session('a', STALE_SESSION_MS / 3_600_000 + 1), NOW)).toBe(false);
  });

  it('ignores completed sessions', () => {
    expect(isCurrentShiftSession(session('a', 1, 'completed'), NOW)).toBe(false);
  });

  it('keeps a session with an unreadable start time', () => {
    expect(isCurrentShiftSession({ status: 'active', actualStart: new Date('bad') }, NOW)).toBe(true);
  });
});

describe('presentUserIds', () => {
  it('counts each person once even with duplicate active sessions', () => {
    expect(presentUserIds([session('a', 1), session('a', 2), session('b', 3)], NOW).sort()).toEqual(['a', 'b']);
  });

  it('excludes stale and completed sessions', () => {
    expect(presentUserIds([session('a', 30), session('b', 1, 'completed'), session('c', 1)], NOW)).toEqual(['c']);
  });
});
