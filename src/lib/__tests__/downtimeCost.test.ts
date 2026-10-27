import { describe, it, expect } from 'vitest';
import { computeEffectiveCostPerHour, computeDowntimeCost, formatDowntimeCost, machineDowntimeCost } from '../downtimeCost';

describe('computeEffectiveCostPerHour', () => {
  it('returns direct rate when costPerHourDown is provided', () => {
    expect(computeEffectiveCostPerHour(5000, 10, 200)).toBe(5000);
  });

  it('returns units × value when no direct rate', () => {
    expect(computeEffectiveCostPerHour(null, 10, 200)).toBe(2000);
  });

  it('returns null when all inputs are null', () => {
    expect(computeEffectiveCostPerHour(null, null, null)).toBeNull();
  });

  it('returns null when unitsPerHour is null but unitValue is set', () => {
    expect(computeEffectiveCostPerHour(null, null, 200)).toBeNull();
  });

  it('returns null when unitValue is null but unitsPerHour is set', () => {
    expect(computeEffectiveCostPerHour(null, 10, null)).toBeNull();
  });
});

describe('computeDowntimeCost', () => {
  it('returns hours × rate for direct rate', () => {
    expect(computeDowntimeCost(3, 1000, null, null)).toBe(3000);
  });

  it('returns hours × computed rate for units mode', () => {
    expect(computeDowntimeCost(2, null, 5, 100)).toBe(1000);
  });

  it('returns null when no rate configured', () => {
    expect(computeDowntimeCost(5, null, null, null)).toBeNull();
  });
});

describe('formatDowntimeCost', () => {
  it('formats correctly for LKR', () => {
    const result = formatDowntimeCost(2.5, 1000, 'LKR');
    expect(result).toContain('2.5h');
    expect(result).toContain('LKR');
    expect(result).toContain('2,500');
  });

  it('includes rate in output', () => {
    const result = formatDowntimeCost(1.0, 500, 'USD');
    expect(result).toContain('USD');
    expect(result).toContain('500');
  });
});

describe('machineDowntimeCost', () => {
  const events = [{ hours: 1.5 }, { hours: 0.5 }];

  it('prices downtime with the direct per-hour cost from the machine profile', () => {
    expect(machineDowntimeCost(events, { costPerHourDown: 1000 })).toEqual({ hours: 2, rate: 1000, cost: 2000 });
  });

  it('falls back to units per hour × value per unit', () => {
    expect(machineDowntimeCost(events, { costPerHourDown: null, unitsPerHour: 20, unitValue: 50 })).toEqual({ hours: 2, rate: 1000, cost: 2000 });
  });

  it('has no cost when the machine has no rate', () => {
    expect(machineDowntimeCost(events, {})).toEqual({ hours: 2, rate: null, cost: null });
  });
});
