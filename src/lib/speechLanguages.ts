import { SUPPORTED_LANGUAGES, type AppLanguage } from './supportedLanguages';

// The spoken languages the voice-dictation button (breakdown report forms and
// the technician's attend-breakdown form) offers — exactly the languages the
// app is set up for in i18n (SUPPORTED_LANGUAGES), and no others.
//
// Both tables are Record<AppLanguage, …>, so adding a language to the i18n
// setup fails to compile until it is given a speech locale here, and nothing
// can be offered for dictation that the app doesn't support. (Previously the
// picker kept its own hand-written list, which had also drifted to include
// Tamil, Hindi, Urdu, Bengali and Arabic.)

/** BCP-47 locale the Web Speech API needs to recognise each language. */
const SPEECH_LOCALE: Record<AppLanguage, string> = {
  'en-US': 'en-US',
  si: 'si-LK',
  es: 'es-ES',
  fr: 'fr-FR',
  de: 'de-DE',
  zh: 'zh-CN',
  ja: 'ja-JP',
};

/** Picker label — the language's English name, plus its own script where that helps the speaker find it. */
const PICKER_LABEL: Record<AppLanguage, string> = {
  'en-US': 'English',
  si: 'Sinhala (සිංහල)',
  es: 'Spanish',
  fr: 'French',
  de: 'German',
  zh: 'Chinese (中文)',
  ja: 'Japanese (日本語)',
};

export interface VoiceInputLanguage {
  /** The i18n language this speech locale belongs to. */
  appLanguage: AppLanguage;
  /** Speech-recognition locale, e.g. "si-LK". */
  code: string;
  label: string;
  /** English name, for translation prompts. */
  name: string;
}

export const VOICE_INPUT_LANGUAGES: readonly VoiceInputLanguage[] = SUPPORTED_LANGUAGES.map((l) => ({
  appLanguage: l.code,
  code: SPEECH_LOCALE[l.code],
  label: PICKER_LABEL[l.code],
  name: l.label,
}));

export const DEFAULT_VOICE_LANGUAGE = SPEECH_LOCALE['en-US'];

/** True only for a speech locale that belongs to a language in the i18n setup. */
export function isVoiceInputLanguage(code: unknown): code is string {
  return typeof code === 'string' && VOICE_INPUT_LANGUAGES.some((l) => l.code === code);
}

/** English name of a supported speech locale ("si-LK" → "Sinhala"); undefined for anything else. */
export function voiceLanguageName(code: string | undefined): string | undefined {
  return VOICE_INPUT_LANGUAGES.find((l) => l.code === code)?.name;
}
