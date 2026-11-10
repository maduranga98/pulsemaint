import { describe, it, expect } from 'vitest';
import { isThemeMode, msUntilNextSwitch, nextThemeMode, resolveTheme } from '../theme/themeMode';

const at = (h: number, m = 0) => new Date(2026, 10, 10, h, m, 0, 0);

describe('resolveTheme', () => {
  it('returns the fixed choice for light and dark, whatever the time', () => {
    expect(resolveTheme('light', at(23))).toBe('light');
    expect(resolveTheme('dark', at(12))).toBe('dark');
  });
  it('auto is light from 06:00 until 18:00 and dark otherwise', () => {
    expect(resolveTheme('auto', at(5, 59))).toBe('dark');
    expect(resolveTheme('auto', at(6))).toBe('light');
    expect(resolveTheme('auto', at(17, 59))).toBe('light');
    expect(resolveTheme('auto', at(18))).toBe('dark');
    expect(resolveTheme('auto', at(0))).toBe('dark');
  });
});

describe('nextThemeMode', () => {
  it('cycles light → dark → auto → light', () => {
    expect(nextThemeMode('light')).toBe('dark');
    expect(nextThemeMode('dark')).toBe('auto');
    expect(nextThemeMode('auto')).toBe('light');
  });
});

describe('msUntilNextSwitch', () => {
  it('counts to the coming 06:00 or 18:00', () => {
    expect(msUntilNextSwitch(at(5, 30))).toBe(30 * 60_000);
    expect(msUntilNextSwitch(at(6))).toBe(12 * 3_600_000);
    expect(msUntilNextSwitch(at(17, 45))).toBe(15 * 60_000);
    expect(msUntilNextSwitch(at(22))).toBe(8 * 3_600_000);
  });
});

describe('isThemeMode', () => {
  it('accepts only the three modes', () => {
    expect(['light', 'dark', 'auto'].every(isThemeMode)).toBe(true);
    expect(isThemeMode('system')).toBe(false);
    expect(isThemeMode(null)).toBe(false);
  });
});
