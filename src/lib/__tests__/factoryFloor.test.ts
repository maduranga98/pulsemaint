import { describe, it, expect } from 'vitest';
import { FLOOR_WO_STARTED, floorWoTypeColor, dominantWoType, FLOOR_WO_TYPE_COLORS, FLOOR_BREAKDOWN_COLOR } from '../factoryFloor';

describe('factory floor rules', () => {
  it('shows a work order only once started, until sign-off', () => {
    for (const s of ['IN_PROGRESS', 'ON_HOLD_PARTS', 'ON_HOLD_APPROVAL', 'COMPLETED']) expect(FLOOR_WO_STARTED(s)).toBe(true);
    for (const s of ['OPEN', 'ASSIGNED', 'SIGNED_OFF', 'CLOSED', 'CANCELLED']) expect(FLOOR_WO_STARTED(s)).toBe(false);
  });
  it('gives each type its own colour, none equal to the breakdown red', () => {
    const colors = Object.values(FLOOR_WO_TYPE_COLORS);
    expect(new Set(colors).size).toBe(colors.length);
    expect(colors).not.toContain(FLOOR_BREAKDOWN_COLOR);
    expect(floorWoTypeColor('PREVENTIVE')).toBe(FLOOR_WO_TYPE_COLORS.PREVENTIVE);
    expect(floorWoTypeColor('weird')).toBe(FLOOR_WO_TYPE_COLORS.OTHER);
  });
  it('picks the most urgent type when a machine has several', () => {
    expect(dominantWoType(['PREVENTIVE', 'CORRECTIVE'])).toBe('CORRECTIVE');
    expect(dominantWoType(['PREVENTIVE', 'BREAKDOWN'])).toBe('BREAKDOWN');
    expect(dominantWoType([])).toBe('OTHER');
  });
});
