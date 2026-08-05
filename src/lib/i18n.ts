import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from '../locales/en.json';
import si from '../locales/si.json';
import ta from '../locales/ta.json';
import bn from '../locales/bn.json';
import ar from '../locales/ar.json';
import hi from '../locales/hi.json';
import ur from '../locales/ur.json';
import zh from '../locales/zh.json';
import ja from '../locales/ja.json';

// Languages with no dedicated app-shell translation yet fall back to en via
// fallbackLng below rather than shipping an empty/duplicate file.
export const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'si', label: 'සිංහල' },
  { code: 'ta', label: 'தமிழ்' },
  { code: 'bn', label: 'বাংলা' },
  { code: 'ar', label: 'العربية' },
  { code: 'hi', label: 'हिन्दी' },
  { code: 'ur', label: 'اردو' },
  { code: 'zh', label: '中文' },
  { code: 'ja', label: '日本語' },
] as const;

export type AppLanguage = (typeof SUPPORTED_LANGUAGES)[number]['code'];
export const RTL_LANGUAGES: AppLanguage[] = ['ar', 'ur'];

const STORAGE_KEY = 'firmicore-language';

function initialLanguage(): AppLanguage {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && SUPPORTED_LANGUAGES.some((l) => l.code === stored)) return stored as AppLanguage;
  } catch {
    // localStorage unavailable (private mode, SSR, etc.) — fall through to default.
  }
  return 'en';
}

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    si: { translation: si },
    ta: { translation: ta },
    bn: { translation: bn },
    ar: { translation: ar },
    hi: { translation: hi },
    ur: { translation: ur },
    zh: { translation: zh },
    ja: { translation: ja },
  },
  lng: initialLanguage(),
  fallbackLng: 'en',
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
  document.documentElement.dir = RTL_LANGUAGES.includes(lang) ? 'rtl' : 'ltr';
  document.documentElement.lang = lang;
}

// Apply direction/lang attributes for whatever language loaded initially.
setAppLanguage(i18n.language as AppLanguage);

export default i18n;
