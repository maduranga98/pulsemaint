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

// Target language codes for the no-key fallback translator (Google's public
// translate_a endpoint) — the same 4 languages the app switcher offers.
const GOOGLE_TRANSLATE_TARGET: Record<AppLanguage, string> = {
  'en-US': 'en',
  es: 'es',
  fr: 'fr',
  de: 'de',
};

/**
 * Translates via Google's public (no API key) translate_a endpoint — the
 * same one Google Translate's own web page and many browser extensions use.
 * This is the default translation path: most deployments of this app don't
 * configure VITE_GEMINI_API_KEY (it's optional, for the Audit module's AI
 * root-cause suggestions), and without a fallback here, voice-dictated
 * Sinhala/Tamil/etc. text would silently never get translated for anyone.
 * Lower quality than Gemini (word/phrase-level rather than meaning-aware),
 * but works out of the box with no configuration. Returns null on any
 * failure (network, parsing, blocked by a firewall/ad-blocker) so the
 * caller can fall back to the original text.
 */
async function translateViaFreeGoogle(text: string, targetLanguage: AppLanguage): Promise<string | null> {
  const tl = GOOGLE_TRANSLATE_TARGET[targetLanguage] ?? 'en';
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${tl}&dt=t&q=${encodeURIComponent(text)}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    // Response shape: [[[translatedChunk, originalChunk, ...], ...], detectedLang, ...]
    const chunks = data?.[0];
    if (!Array.isArray(chunks)) return null;
    const translated = chunks.map((c: unknown[]) => c?.[0] ?? '').join('');
    return translated.trim() || null;
  } catch {
    return null;
  }
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
 * same record doesn't re-call the translation API.
 *
 * Uses Gemini (meaning-aware, given technical/CMMS context) when
 * VITE_GEMINI_API_KEY is configured; otherwise falls back to Google's free
 * translate endpoint so this works with zero configuration. Falls back to
 * the original text only if both are unavailable/fail.
 */
export async function translateForDisplay(text: string, targetLanguage: AppLanguage): Promise<string> {
  const trimmed = text.trim();
  if (!trimmed) return text;

  const key = displayCacheKey(trimmed, targetLanguage);
  const cached = readDisplayCache(key);
  if (cached !== undefined) return cached;

  const translated = hasGeminiKey()
    ? await translateSpokenText(trimmed, targetLanguage)
    : (await translateViaFreeGoogle(trimmed, targetLanguage)) ?? trimmed;
  writeDisplayCache(key, translated);
  return translated;
}
