import { describe, it, expect } from 'vitest';
import { computeRiskScore, getRiskLevel, isHighPriorityAlert } from '../backlogUtils';

describe('computeRiskScore', () => {
  it('multiplies likelihood by consequence', () => {
    expect(computeRiskScore(3, 4)).toBe(12);
  });

  it('returns 1 for minimum values', () => {
    expect(computeRiskScore(1, 1)).toBe(1);
  });

  it('returns 25 for maximum values', () => {
    expect(computeRiskScore(5, 5)).toBe(25);
  });

  it('returns 5 for 1×5', () => {
    expect(computeRiskScore(1, 5)).toBe(5);
  });
});

describe('getRiskLevel', () => {
  it('returns low for score of 1', () => {
    expect(getRiskLevel(1)).toBe('low');
  });

  it('returns low for score of 6', () => {
    expect(getRiskLevel(6)).toBe('low');
  });

  it('returns medium for score of 7', () => {
    expect(getRiskLevel(7)).toBe('medium');
  });

  it('returns medium for score of 14', () => {
    expect(getRiskLevel(14)).toBe('medium');
  });

  it('returns high for score of 15', () => {
    expect(getRiskLevel(15)).toBe('high');
  });

  it('returns high for score of 25', () => {
    expect(getRiskLevel(25)).toBe('high');
  });
});

describe('isHighPriorityAlert', () => {
  it('returns true for risk >= 15 and criticality <= 2', () => {
    expect(isHighPriorityAlert(15, 1)).toBe(true);
  });

  it('returns true for risk 25 and criticality 2', () => {
    expect(isHighPriorityAlert(25, 2)).toBe(true);
  });

  it('returns false for risk >= 15 but criticality > 2', () => {
    expect(isHighPriorityAlert(15, 3)).toBe(false);
  });

  it('returns false for risk < 15 even with criticality 1', () => {
    expect(isHighPriorityAlert(14, 1)).toBe(false);
  });

  it('returns false when both conditions fail', () => {
    expect(isHighPriorityAlert(10, 4)).toBe(false);
  });
});
