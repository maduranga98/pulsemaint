import { describe, it, expect } from 'vitest';
import { attemptsRemaining } from '../training/quizScorer';

describe('attemptsRemaining', () => {
  it('counts down from the quiz limit', () => {
    expect(attemptsRemaining(3, 0)).toBe(3);
    expect(attemptsRemaining(3, 1)).toBe(2);
    expect(attemptsRemaining(3, 3)).toBe(0);
  });

  it('treats a limit of 0 as unlimited', () => {
    expect(attemptsRemaining(0, 5)).toBeNull();
  });

  it('treats a missing attemptsUsed as none used, not NaN', () => {
    // Assignments created before every progress field was persisted have no
    // attemptsUsed — this used to yield NaN, which read as "no attempts left"
    // and disabled the Start Quiz button.
    expect(attemptsRemaining(3, undefined)).toBe(3);
    expect(attemptsRemaining(3, null)).toBe(3);
  });

  it('treats a missing maxAttempts as unlimited rather than NaN', () => {
    expect(attemptsRemaining(undefined, 2)).toBeNull();
    expect(attemptsRemaining(null, undefined)).toBeNull();
  });

  it('never goes negative when more attempts were used than allowed', () => {
    expect(attemptsRemaining(2, 5)).toBe(0);
  });
});
