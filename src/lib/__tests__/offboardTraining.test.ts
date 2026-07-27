import { describe, it, expect } from 'vitest';
import { Timestamp } from 'firebase/firestore';
import {
  getModuleCategory,
  getAssignmentCategory,
  isOffboardModule,
  computeDurationDays,
  isOffboardCompletionValid,
  isOffboardReportOverdue,
  daysOverdue,
  DEFAULT_OFFBOARD_QUESTIONS,
} from '../training/offboardTraining';

describe('offboardTraining', () => {
  it('treats missing category as machine (legacy docs)', () => {
    expect(getModuleCategory(undefined)).toBe('machine');
    expect(getModuleCategory({} as any)).toBe('machine');
    expect(getModuleCategory({ category: undefined } as any)).toBe('machine');
    expect(getAssignmentCategory({} as any)).toBe('machine');
  });

  it('recognizes offboard category', () => {
    expect(getModuleCategory({ category: 'offboard' } as any)).toBe('offboard');
    expect(isOffboardModule({ category: 'offboard' } as any)).toBe(true);
    expect(isOffboardModule({ category: 'machine' } as any)).toBe(false);
  });

  it('computes inclusive duration in days', () => {
    const start = Timestamp.fromDate(new Date('2026-01-01T00:00:00Z'));
    const end = Timestamp.fromDate(new Date('2026-01-05T00:00:00Z'));
    expect(computeDurationDays(start, end)).toBe(5);
    expect(computeDurationDays(start, start)).toBe(1);
    expect(computeDurationDays(null, end)).toBe(0);
    expect(computeDurationDays(end, start)).toBe(0);
  });

  it('validates offboard completion requires non-empty knowledge gained', () => {
    expect(isOffboardCompletionValid(null)).toBe(false);
    expect(isOffboardCompletionValid({ knowledgeGained: '' })).toBe(false);
    expect(isOffboardCompletionValid({ knowledgeGained: '   ' })).toBe(false);
    expect(isOffboardCompletionValid({ knowledgeGained: 'Learned X' })).toBe(true);
  });

  it('flags overdue offboard reports only when unsubmitted and past end date', () => {
    const past = Timestamp.fromDate(new Date(Date.now() - 86400000 * 3));
    const future = Timestamp.fromDate(new Date(Date.now() + 86400000 * 3));
    expect(isOffboardReportOverdue(past, null)).toBe(true);
    expect(isOffboardReportOverdue(past, Timestamp.now())).toBe(false);
    expect(isOffboardReportOverdue(future, null)).toBe(false);
    expect(daysOverdue(past)).toBeGreaterThanOrEqual(2);
    expect(daysOverdue(future)).toBe(0);
  });

  it('ships an 8-question default bank', () => {
    expect(DEFAULT_OFFBOARD_QUESTIONS).toHaveLength(8);
  });
});
