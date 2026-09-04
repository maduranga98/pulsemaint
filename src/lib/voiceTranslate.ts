import { generateGeminiJson, hasGeminiKey } from './gemini';
import type { AppLanguage } from './i18n';

const APP_LANGUAGE_NAMES: Record<AppLanguage, string> = {
  'en-US': 'English',
  es: 'Spanish',
  fr: 'French',
  de: 'German',
};

interface TranslationResult {
  translatedText: string;
}

/**
 * Detects the spoken language of `text` (transcribed from whatever language
 * the user spoke) and translates it into `targetLanguage`, the app's
 * currently selected UI language. Falls back to the original text whenever
 * no Gemini key is configured or the call fails, so dictation still works
 * without translation rather than blocking the user.
 */
export async function translateSpokenText(text: string, targetLanguage: AppLanguage): Promise<string> {
  if (!hasGeminiKey()) return text;

  const targetLanguageName = APP_LANGUAGE_NAMES[targetLanguage] ?? 'English';

  try {
    const result = await generateGeminiJson<TranslationResult>(text, {
      systemInstruction:
        `You translate voice-dictated maintenance breakdown reports. Detect the language of the ` +
        `user's message (it may be in any language) and translate it into ${targetLanguageName}. ` +
        `If the message is already in ${targetLanguageName}, return it unchanged (only fixing obvious ` +
        `dictation artifacts like duplicated words). Preserve technical terms, machine names, and numbers ` +
        `exactly. Respond with JSON only.`,
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
