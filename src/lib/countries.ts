/**
 * Every ISO 3166-1 alpha-2 country, named in the user's language through
 * Intl.DisplayNames (so names follow the i18n language and stay current with
 * the browser's CLDR data). Values are stored as the 2-letter code; a country
 * typed by hand that isn't in the list is stored as the typed text.
 */
export const COUNTRY_CODES = (
  'AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ ' +
  'CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR ' +
  'GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP ' +
  'KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT ' +
  'MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW ' +
  'SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG ' +
  'UM US UY UZ VA VC VE VG VI VN VU WF WS XK YE YT ZA ZM ZW'
).split(' ');

const namers = new Map<string, Intl.DisplayNames | null>();
function namer(lang: string): Intl.DisplayNames | null {
  if (!namers.has(lang)) {
    try {
      namers.set(lang, new Intl.DisplayNames([lang, 'en'], { type: 'region' }));
    } catch {
      namers.set(lang, null);
    }
  }
  return namers.get(lang)!;
}

/** Country name for a code in `lang` (falls back to English, then the code). */
export function countryName(code: string, lang = 'en'): string {
  try {
    return namer(lang)?.of(code) ?? namer('en')?.of(code) ?? code;
  } catch {
    return code;
  }
}

/** All countries as { code, name } sorted by name in `lang`. */
export function countryOptions(lang = 'en'): { code: string; name: string }[] {
  return COUNTRY_CODES.map((code) => ({ code, name: countryName(code, lang) }))
    .sort((a, b) => a.name.localeCompare(b.name, lang));
}

const norm = (s: string) => s.trim().toLocaleLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/**
 * Turns what the user picked/typed into the stored value: the ISO code when
 * it matches a country (by code, or by name in `lang` or English), otherwise
 * the trimmed text as typed.
 */
export function resolveCountry(input: string, lang = 'en'): string {
  const text = input.trim();
  if (!text) return '';
  const upper = text.toUpperCase();
  if (text.length === 2 && COUNTRY_CODES.includes(upper)) return upper;
  const n = norm(text);
  const hit = COUNTRY_CODES.find((code) => norm(countryName(code, lang)) === n || norm(countryName(code, 'en')) === n);
  return hit ?? text;
}

/** Display label for a stored value (code → localized name; free text unchanged). */
export function countryLabel(value: string | null | undefined, lang = 'en'): string {
  if (!value) return '';
  return value.length === 2 && COUNTRY_CODES.includes(value.toUpperCase()) ? countryName(value.toUpperCase(), lang) : value;
}
