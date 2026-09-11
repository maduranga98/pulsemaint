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

/** Formats `date` as a long date (day, full month name, year) in the current app language. */
export function formatLongDate(date: Date): string {
  const locale = DATE_LOCALES[i18n.language] ?? 'en-GB';
  return date.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' });
}
