import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import enUS from '../locales/en-US.json';
import enGB from '../locales/en-GB.json';
import si from '../locales/si.json';
import ta from '../locales/ta.json';
import bn from '../locales/bn.json';
import ar from '../locales/ar.json';
import hi from '../locales/hi.json';
import ur from '../locales/ur.json';
import zh from '../locales/zh.json';
import ja from '../locales/ja.json';
import es from '../locales/es.json';
import fr from '../locales/fr.json';
import de from '../locales/de.json';

// Languages with no dedicated app-shell translation yet fall back to
// en-US via fallbackLng below rather than shipping an empty/duplicate file.
// Labels are deliberately plain English names (not each language's native
// script) per product decision — easier to scan in a dropdown for users who
// may not read every script listed.
//
// The switcher is deliberately limited to these 4 by product decision —
// other locale files (en-GB, si, ta, bn, ar, hi, ur, zh, ja) still exist and
// stay registered as i18next resources below (so a user previously on one
// of them doesn't lose their translations if re-selected via localStorage/
// an old link), they're just not offered as a pick here.
export const SUPPORTED_LANGUAGES = [
  { code: 'en-US', label: 'English' },
  { code: 'es', label: 'Spanish' },
  { code: 'fr', label: 'French' },
  { code: 'de', label: 'German' },
] as const;

export type AppLanguage = (typeof SUPPORTED_LANGUAGES)[number]['code'];
// The app's layout (fixed-side sidebar, flex directions) isn't built for RTL
// mirroring — flipping dir="rtl" breaks the sidebar/header layout instead of
// properly mirroring it. Keep the document LTR for every language; Arabic/
// Urdu text itself still renders correctly right-to-left within LTR blocks.

const STORAGE_KEY = 'firmicore-language';

function initialLanguage(): AppLanguage {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && SUPPORTED_LANGUAGES.some((l) => l.code === stored)) return stored as AppLanguage;
  } catch {
    // localStorage unavailable (private mode, SSR, etc.) — fall through to default.
  }
  return 'en-US';
}

i18n.use(initReactI18next).init({
  resources: {
    'en-US': { translation: enUS },
    'en-GB': { translation: enGB },
    si: { translation: si },
    ta: { translation: ta },
    bn: { translation: bn },
    ar: { translation: ar },
    hi: { translation: hi },
    ur: { translation: ur },
    zh: { translation: zh },
    ja: { translation: ja },
    es: { translation: es },
    fr: { translation: fr },
    de: { translation: de },
  },
  lng: initialLanguage(),
  fallbackLng: 'en-US',
  interpolation: {
    escapeValue: false,
  },
});

export function setAppLanguage(lang: AppLanguage) {
  void i18n.changeLanguage(lang);
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    // ignore — persistence is a convenience, not a requirement.
  }
  document.documentElement.lang = lang;
}

// Apply the lang attribute for whatever language loaded initially.
setAppLanguage(i18n.language as AppLanguage);

export default i18n;
