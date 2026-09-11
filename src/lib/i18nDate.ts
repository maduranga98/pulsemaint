import i18n from './i18n';

// i18next's app-language codes mapped to a locale Intl.DateTimeFormat
// understands, so a formatted date matches the app's currently selected
// language (e.g. "11 September 2026" in English vs. "2026年9月11日" in
// Chinese) instead of a single hardcoded locale.
const DATE_LOCALES: Record<string, string> = {
  'en-US': 'en-US',
  es: 'es-ES',
  fr: 'fr-FR',
  de: 'de-DE',
  zh: 'zh-CN',
  ja: 'ja-JP',
};

function currentLocale(): string {
  return DATE_LOCALES[i18n.language] ?? 'en-GB';
}

/** Formats `date` as a long date (day, full month name, year) in the current app language. */
export function formatLongDate(date: Date): string {
  return date.toLocaleDateString(currentLocale(), { day: 'numeric', month: 'long', year: 'numeric' });
}

/** Formats `date` as a short numeric date (e.g. 9/11/2026) in the current app language. */
export function formatShortDate(date: Date): string {
  return date.toLocaleDateString(currentLocale());
}

/** Formats `date` as a short numeric date + time in the current app language. */
export function formatShortDateTime(date: Date): string {
  return date.toLocaleString(currentLocale());
}

/** Formats `date` as an abbreviated month + year (e.g. "Sep 2026") in the current app language. */
export function formatMonthYear(date: Date): string {
  return date.toLocaleDateString(currentLocale(), { month: 'short', year: 'numeric' });
}
