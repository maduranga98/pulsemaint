import { describe, it, expect } from 'vitest';
import { SUPPORTED_LANGUAGES } from '../supportedLanguages';
import {
  DEFAULT_VOICE_LANGUAGE,
  VOICE_INPUT_LANGUAGES,
  isVoiceInputLanguage,
  voiceLanguageName,
} from '../speechLanguages';

describe('voice dictation languages', () => {
  it('offers exactly the languages the app is set up for in i18n — same set, same order', () => {
    expect(VOICE_INPUT_LANGUAGES.map((l) => l.appLanguage)).toEqual(SUPPORTED_LANGUAGES.map((l) => l.code));
  });

  it('has one distinct speech locale per language', () => {
    const codes = VOICE_INPUT_LANGUAGES.map((l) => l.code);
    expect(new Set(codes).size).toBe(SUPPORTED_LANGUAGES.length);
    expect(codes).toEqual(['en-US', 'si-LK', 'es-ES', 'fr-FR', 'de-DE', 'zh-CN', 'ja-JP']);
  });

  it('no longer offers languages outside the i18n setup', () => {
    for (const other of ['ta-LK', 'hi-IN', 'ur-PK', 'bn-BD', 'ar-SA', 'pt-BR', 'ru-RU']) {
      expect(isVoiceInputLanguage(other)).toBe(false);
      expect(VOICE_INPUT_LANGUAGES.some((l) => l.code === other)).toBe(false);
    }
  });

  it('accepts only supported speech locales as a saved preference', () => {
    expect(isVoiceInputLanguage('si-LK')).toBe(true);
    expect(isVoiceInputLanguage('ta-LK')).toBe(false);
    expect(isVoiceInputLanguage('si')).toBe(false); // an i18n code, not a speech locale
    expect(isVoiceInputLanguage(null)).toBe(false);
    expect(isVoiceInputLanguage(undefined)).toBe(false);
  });

  it('defaults to a supported language', () => {
    expect(isVoiceInputLanguage(DEFAULT_VOICE_LANGUAGE)).toBe(true);
  });

  it('names a supported locale in English for translation prompts, and nothing else', () => {
    expect(voiceLanguageName('si-LK')).toBe('Sinhala');
    expect(voiceLanguageName('zh-CN')).toBe('Chinese');
    expect(voiceLanguageName('ta-LK')).toBeUndefined();
    expect(voiceLanguageName(undefined)).toBeUndefined();
  });
});
