import { describe, it, expect } from 'vitest';
import { computeLotoGatePassed, computeChecklistItemResult } from '../lotoGate';

// computeLotoGatePassed tests
describe('computeLotoGatePassed', () => {
  const basePermit = {
    isolationChecklist: [
      { pointId: 'p1', locked: true, lockedBy: 'u1', lockedByName: 'Alice', lockedAt: null },
      { pointId: 'p2', locked: true, lockedBy: 'u2', lockedByName: 'Bob', lockedAt: null },
    ],
    zeroEnergyVerified: true,
    status: 'active' as const,
  };

  it('returns false when permit is null', () => {
    expect(computeLotoGatePassed(null, null)).toBe(false);
  });

  it('returns false when isolation checklist is empty', () => {
    expect(computeLotoGatePassed({ ...basePermit, isolationChecklist: [] }, null)).toBe(false);
  });

  it('returns false when not all points locked', () => {
    const permit = {
      ...basePermit,
      isolationChecklist: [
        { pointId: 'p1', locked: true, lockedBy: 'u1', lockedByName: 'Alice', lockedAt: null },
        { pointId: 'p2', locked: false, lockedBy: null, lockedByName: null, lockedAt: null },
      ],
    };
    expect(computeLotoGatePassed(permit, null)).toBe(false);
  });

  it('returns false when zero energy not verified', () => {
    expect(computeLotoGatePassed({ ...basePermit, zeroEnergyVerified: false }, null)).toBe(false);
  });

  it('returns true when all locked + verified + no PTW category', () => {
    expect(computeLotoGatePassed(basePermit, null)).toBe(true);
  });

  it('returns false when PTW required but permit not active', () => {
    expect(computeLotoGatePassed({ ...basePermit, status: 'draft' as const }, 'hot-work')).toBe(false);
  });

  it('returns true when PTW required and permit is active', () => {
    expect(computeLotoGatePassed({ ...basePermit, status: 'active' as const }, 'hot-work')).toBe(true);
  });
});

// computeChecklistItemResult tests
describe('computeChecklistItemResult', () => {
  it('returns null when value is null', () => {
    expect(computeChecklistItemResult(null, 10, 20)).toBeNull();
  });

  it('returns null when min is null', () => {
    expect(computeChecklistItemResult(15, null, 20)).toBeNull();
  });

  it('returns null when max is null', () => {
    expect(computeChecklistItemResult(15, 10, null)).toBeNull();
  });

  it('returns pass when value is within range', () => {
    expect(computeChecklistItemResult(15, 10, 20)).toBe('pass');
  });

  it('returns pass on lower boundary', () => {
    expect(computeChecklistItemResult(10, 10, 20)).toBe('pass');
  });

  it('returns pass on upper boundary', () => {
    expect(computeChecklistItemResult(20, 10, 20)).toBe('pass');
  });

  it('returns fail when value is below min', () => {
    expect(computeChecklistItemResult(9, 10, 20)).toBe('fail');
  });

  it('returns fail when value is above max', () => {
    expect(computeChecklistItemResult(21, 10, 20)).toBe('fail');
  });

  it('handles decimal values', () => {
    expect(computeChecklistItemResult(10.5, 10, 11)).toBe('pass');
    expect(computeChecklistItemResult(9.9, 10, 11)).toBe('fail');
  });
});
