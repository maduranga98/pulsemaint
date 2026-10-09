import { describe, expect, it } from 'vitest';
import { COUNTRY_CODES, countryLabel, countryOptions, resolveCountry } from '../countries';

describe('countries', () => {
  it('lists every ISO country once', () => {
    expect(new Set(COUNTRY_CODES).size).toBe(COUNTRY_CODES.length);
    expect(COUNTRY_CODES.length).toBeGreaterThan(245);
    expect(countryOptions('en').find((c) => c.code === 'LK')?.name).toBe('Sri Lanka');
  });

  it('resolves names and codes to the ISO code, keeps unknown text', () => {
    expect(resolveCountry('sri lanka')).toBe('LK');
    expect(resolveCountry('lk')).toBe('LK');
    expect(resolveCountry('  Germany ')).toBe('DE');
    expect(resolveCountry('Allemagne', 'fr')).toBe('DE');
    expect(resolveCountry('Atlantis')).toBe('Atlantis');
    expect(resolveCountry('')).toBe('');
  });

  it('labels codes and passes free text through', () => {
    expect(countryLabel('US')).toBe('United States');
    expect(countryLabel('Atlantis')).toBe('Atlantis');
    expect(countryLabel(null)).toBe('');
  });
});
