import { describe, it, expect } from 'vitest';
import { formatMoneyCompactIn, formatMoneyIn } from '../money';

describe('currency formatting', () => {
  it('uses the given currency and whole units by default', () => {
    expect(formatMoneyIn('USD', 8500)).toBe('USD 8,500');
    expect(formatMoneyIn('LKR', null)).toBe('LKR 0');
    expect(formatMoneyIn('AED', 1234.5, 2)).toBe('AED 1,234.50');
  });
  it('compacts big numbers', () => {
    expect(formatMoneyCompactIn('USD', 8500)).toBe('USD 8.5K');
    expect(formatMoneyCompactIn('USD', 25000)).toBe('USD 25K');
    expect(formatMoneyCompactIn('USD', 0)).toBe('USD 0');
    expect(formatMoneyCompactIn('SAR', 2_500_000)).toBe('SAR 2.5M');
  });
});
