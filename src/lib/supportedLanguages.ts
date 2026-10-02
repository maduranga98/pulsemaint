// The languages the app is set up for (the i18n language switcher).
//
// Kept in its own module with no side effects so anything that needs the list —
// the voice-dictation picker, translation helpers, tests — can import it
// without initialising i18next. lib/i18n.ts re-exports both names.
//
// The switcher is deliberately limited to these by product decision — other
// locale files (en-GB, ta, bn, ar, hi, ur) still exist and stay registered as
// i18next resources, they're just not offered as a pick. Sinhala is offered
// despite being a partial translation because it's an actively-used language
// for this company. Labels are plain English names, per product decision.
export const SUPPORTED_LANGUAGES = [
  { code: 'en-US', label: 'English' },
  { code: 'si', label: 'Sinhala' },
  { code: 'es', label: 'Spanish' },
  { code: 'fr', label: 'French' },
  { code: 'de', label: 'German' },
  { code: 'zh', label: 'Chinese' },
  { code: 'ja', label: 'Japanese' },
] as const;

export type AppLanguage = (typeof SUPPORTED_LANGUAGES)[number]['code'];
