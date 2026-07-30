import { describe, expect, it } from 'vitest';
import {
  isLearnerCompletedStatus,
  isLearnerOutstanding,
} from '../training/assignmentStatus';

describe('isLearnerCompletedStatus', () => {
  it('counts a module awaiting the practical sign-off as completed', () => {
    // The learner has passed the final test; only a manager's sign-off is
    // left, so My Training shows it under Completed.
    expect(isLearnerCompletedStatus('awaiting_practical')).toBe(true);
  });

  it('counts certified and legacy quiz_passed assignments as completed', () => {
    expect(isLearnerCompletedStatus('certified')).toBe(true);
    expect(isLearnerCompletedStatus('quiz_passed')).toBe(true);
  });

  it('does not count work the learner still has to do', () => {
    expect(isLearnerCompletedStatus('not_started')).toBe(false);
    expect(isLearnerCompletedStatus('in_progress')).toBe(false);
    expect(isLearnerCompletedStatus('quiz_failed')).toBe(false);
    expect(isLearnerCompletedStatus('retraining_required')).toBe(false);
    expect(isLearnerCompletedStatus('expired')).toBe(false);
  });
});

describe('isLearnerOutstanding', () => {
  it('excludes completed and expired assignments', () => {
    expect(isLearnerOutstanding('awaiting_practical')).toBe(false);
    expect(isLearnerOutstanding('certified')).toBe(false);
    expect(isLearnerOutstanding('expired')).toBe(false);
  });

  it('includes everything the learner still has to work on', () => {
    expect(isLearnerOutstanding('not_started')).toBe(true);
    expect(isLearnerOutstanding('in_progress')).toBe(true);
    expect(isLearnerOutstanding('quiz_failed')).toBe(true);
    expect(isLearnerOutstanding('retraining_required')).toBe(true);
  });
});
