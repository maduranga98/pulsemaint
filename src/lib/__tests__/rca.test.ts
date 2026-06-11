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
  it('returns true for low severity without RCA', () => {
    expect(canCloseBreakdown('low', null, false)).toBe(true);
  });

  it('returns true for low severity even with incomplete RCA', () => {
    expect(canCloseBreakdown('low', { status: 'open', rootCause: '' }, false)).toBe(true);
  });

  it('returns false for critical severity with no RCA and not supervisor', () => {
    expect(canCloseBreakdown('critical', null, false)).toBe(false);
  });

  it('returns false for high severity with open RCA and not supervisor', () => {
    expect(canCloseBreakdown('high', { status: 'open', rootCause: '' }, false)).toBe(false);
  });

  it('returns true for supervisor with any RCA (even open)', () => {
    expect(canCloseBreakdown('critical', { status: 'open', rootCause: '' }, true)).toBe(true);
  });

  it('returns false for supervisor with null RCA on required severity', () => {
    expect(canCloseBreakdown('critical', null, true)).toBe(false);
  });

  it('returns true for non-supervisor with completed RCA and non-empty rootCause', () => {
    expect(canCloseBreakdown('medium', { status: 'completed', rootCause: 'Root cause identified' }, false)).toBe(true);
  });

  it('returns false for non-supervisor with completed RCA but empty rootCause', () => {
    expect(canCloseBreakdown('medium', { status: 'completed', rootCause: '' }, false)).toBe(false);
  });

  it('returns true for supervisor with completed RCA', () => {
    expect(canCloseBreakdown('high', { status: 'completed', rootCause: 'Bearing failure' }, true)).toBe(true);
  });

  it('returns false for medium severity with null RCA and not supervisor', () => {
    expect(canCloseBreakdown('medium', null, false)).toBe(false);
  });

  it('returns true for low severity even when supervisor is false', () => {
    expect(canCloseBreakdown('low', null, false)).toBe(true);
  });

  it('returns true for low severity even when supervisor is true', () => {
    expect(canCloseBreakdown('low', null, true)).toBe(true);
  });
});
