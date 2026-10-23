import { describe, it, expect } from 'vitest';
import { isRCARequired, isRCAComplete, canCloseBreakdown } from '../rcaUtils';

describe('isRCARequired', () => {
  it('returns true for critical severity', () => {
    expect(isRCARequired('critical')).toBe(true);
  });

  it('returns true for high severity', () => {
    expect(isRCARequired('high')).toBe(true);
  });

  it('returns true for medium severity', () => {
    expect(isRCARequired('medium')).toBe(true);
  });

  it('returns false for low severity', () => {
    expect(isRCARequired('low')).toBe(false);
  });
});

describe('isRCAComplete', () => {
  it('returns false when rca is null', () => {
    expect(isRCAComplete(null)).toBe(false);
  });

  it('returns false when status is open', () => {
    expect(isRCAComplete({ status: 'open', rootCause: 'Worn bearing' })).toBe(false);
  });

  it('returns false when rootCause is empty string', () => {
    expect(isRCAComplete({ status: 'completed', rootCause: '' })).toBe(false);
  });

  it('returns false when rootCause is only whitespace', () => {
    expect(isRCAComplete({ status: 'completed', rootCause: '   ' })).toBe(false);
  });

  it('returns true when status is completed and rootCause is non-empty', () => {
    expect(isRCAComplete({ status: 'completed', rootCause: 'Lack of lubrication' })).toBe(true);
  });
});

describe('canCloseBreakdown', () => {
  it('low severity quick fixes need no RCA from the signer', () => {
    expect(canCloseBreakdown('low', null)).toBe(true);
    expect(canCloseBreakdown('low', { status: 'open', rootCause: '' })).toBe(true);
  });

  it('unclassified severity does not require an RCA', () => {
    expect(canCloseBreakdown(null, null)).toBe(true);
  });

  it('medium / high / critical need a completed RCA', () => {
    expect(canCloseBreakdown('critical', null)).toBe(false);
    expect(canCloseBreakdown('medium', null)).toBe(false);
    expect(canCloseBreakdown('high', { status: 'completed', rootCause: 'Bearing failure' })).toBe(true);
  });

  it('a half-finished RCA does not count, even for a supervisor', () => {
    expect(canCloseBreakdown('critical', { status: 'open', rootCause: '' })).toBe(false);
    expect(canCloseBreakdown('high', { status: 'open', rootCause: 'draft' })).toBe(false);
  });

  it('a completed RCA with an empty root cause does not count', () => {
    expect(canCloseBreakdown('medium', { status: 'completed', rootCause: '' })).toBe(false);
  });
});
