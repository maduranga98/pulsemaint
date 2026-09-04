import { generateGeminiJson, hasGeminiKey } from './gemini';
import type { AppLanguage } from './i18n';

const APP_LANGUAGE_NAMES: Record<AppLanguage, string> = {
  'en-US': 'English',
  es: 'Spanish',
  fr: 'French',
  de: 'German',
};

// Maps the BCP-47 speech-recognition locale (what the speaker picked in
// VoiceDictationButton) to a plain language name, so the translation prompt
// is told the source language explicitly instead of guessing it from a
// possibly short or garbled transcript.
const SPEECH_LANGUAGE_NAMES: Record<string, string> = {
  'en-US': 'English',
  'si-LK': 'Sinhala',
  'ta-LK': 'Tamil',
  'hi-IN': 'Hindi',
  'ur-PK': 'Urdu',
  'bn-BD': 'Bengali',
  'ar-SA': 'Arabic',
  'zh-CN': 'Chinese',
  'ja-JP': 'Japanese',
  'es-ES': 'Spanish',
  'fr-FR': 'French',
  'de-DE': 'German',
};

interface TranslationResult {
  translatedText: string;
}

/**
 * Translates `text` — a transcript from the Web Speech API in the given
 * `sourceLang` locale (e.g. "si-LK", "ta-LK") — into `targetLanguage`, the
 * app's currently selected UI language, preserving meaning rather than
 * translating word-for-word. Falls back to the original text whenever no
 * Gemini key is configured or the call fails, so dictation still works
 * without translation rather than blocking the user.
 */
export async function translateSpokenText(
  text: string,
  targetLanguage: AppLanguage,
  sourceLang?: string
): Promise<string> {
  if (!hasGeminiKey()) return text;

  const targetLanguageName = APP_LANGUAGE_NAMES[targetLanguage] ?? 'English';
  const sourceLanguageName = sourceLang ? SPEECH_LANGUAGE_NAMES[sourceLang] : undefined;

  try {
    const result = await generateGeminiJson<TranslationResult>(text, {
      systemInstruction:
        `You translate voice-dictated maintenance breakdown reports for a CMMS app used on a factory floor. ` +
        (sourceLanguageName
          ? `The user's message was transcribed from speech in ${sourceLanguageName}. `
          : `Detect the language of the user's message (it may be in any language). `) +
        `Translate it into natural, fluent ${targetLanguageName}, preserving the speaker's exact meaning and ` +
        `intent — do not translate word-for-word or transliterate; render idioms and phrasing the way a native ` +
        `${targetLanguageName} speaker describing the same machine fault would say it. ` +
        `If the message is already in ${targetLanguageName}, return it unchanged (only fixing obvious ` +
        `speech-recognition artifacts like duplicated words or stray filler words). Preserve technical terms, ` +
        `machine names, part numbers, and quantities exactly as spoken — do not translate proper nouns or model ` +
        `numbers. Respond with JSON only.`,
      responseSchema: {
        type: 'object',
        properties: {
          translatedText: { type: 'string' },
        },
        required: ['translatedText'],
      },
    });
    return result.translatedText?.trim() || text;
  } catch {
    return text;
  }
}

// In-memory + sessionStorage cache for display-time translation, keyed by
// the exact text and target language — the same breakdown description gets
// rendered on every viewer's screen (detail card, list row, ...) and on
// every re-render, so without caching it would re-call Gemini each time.
const displayCache = new Map<string, string>();

function displayCacheKey(text: string, targetLanguage: AppLanguage): string {
  return `${targetLanguage}::${text}`;
}

function readDisplayCache(key: string): string | undefined {
  const hit = displayCache.get(key);
  if (hit !== undefined) return hit;
  try {
    const stored = sessionStorage.getItem(`pm.translateCache:${key}`);
    if (stored !== null) {
      displayCache.set(key, stored);
      return stored;
    }
  } catch {
    // ignore — cache is a perf optimization, not a requirement.
  }
  return undefined;
}

function writeDisplayCache(key: string, value: string): void {
  displayCache.set(key, value);
  try {
    sessionStorage.setItem(`pm.translateCache:${key}`, value);
  } catch {
    // ignore — sessionStorage full/unavailable, in-memory cache still helps.
  }
}

/**
 * Translates arbitrary already-stored text (a breakdown "what happened"
 * description, technician findings, etc. — whatever language it was
 * originally entered or dictated in) into `targetLanguage` for display,
 * i.e. whichever language the *viewer* currently has selected in the app —
 * not the language the reporter had selected when they submitted it.
 * Results are cached per (text, targetLanguage) pair so re-rendering the
 * same record doesn't re-call the translation API. Falls back to the
 * original text when no Gemini key is configured or the call fails.
 */
export async function translateForDisplay(text: string, targetLanguage: AppLanguage): Promise<string> {
  const trimmed = text.trim();
  if (!trimmed || !hasGeminiKey()) return text;

  const key = displayCacheKey(trimmed, targetLanguage);
  const cached = readDisplayCache(key);
  if (cached !== undefined) return cached;

  const translated = await translateSpokenText(trimmed, targetLanguage);
  writeDisplayCache(key, translated);
  return translated;
}
