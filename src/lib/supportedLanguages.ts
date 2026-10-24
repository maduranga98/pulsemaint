// The languages the app is set up for (the i18n language switcher).
//
// Kept in its own module with no side effects so anything that needs the list —
// the voice-dictation picker, translation helpers, tests — can import it
// without initialising i18next. lib/i18n.ts re-exports both names.
//
// The switcher is deliberately limited to these by product decision — other
// locale files (en-GB, bn, ar, hi, ur) still exist and stay registered as
// i18next resources, they're just not offered as a pick. Tamil is offered
// although its translation is still partial (anything missing falls back to
// English) because it's an actively-used language for this company. Labels are
// plain English names in the picker; `short` is the two-letter code the header
// switcher shows once a language is selected.
export const SUPPORTED_LANGUAGES = [
  { code: 'en-US', label: 'English', short: 'EN' },
  { code: 'si', label: 'Sinhala', short: 'SI' },
  { code: 'ta', label: 'Tamil', short: 'TA' },
  { code: 'es', label: 'Spanish', short: 'ES' },
  { code: 'fr', label: 'French', short: 'FR' },
  { code: 'de', label: 'German', short: 'DE' },
  { code: 'zh', label: 'Chinese', short: 'ZH' },
  { code: 'ja', label: 'Japanese', short: 'JA' },
] as const;

export type AppLanguage = (typeof SUPPORTED_LANGUAGES)[number]['code'];
