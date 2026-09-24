import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase';

/**
 * AI features call Claude through the `claudeJson` Cloud Function, which
 * holds ANTHROPIC_API_KEY in Secret Manager — the key never ships in the
 * browser bundle. Set VITE_DISABLE_AI=1 to skip AI entirely and always use
 * the non-AI fallbacks (e.g. local dev without deployed functions).
 */
export function isClaudeEnabled(): boolean {
  return import.meta.env.VITE_DISABLE_AI !== '1';
}

interface ClaudeJsonOptions {
  systemInstruction?: string;
  /**
   * JSON schema the response must match — enforced server-side via
   * structured outputs. Every object in it needs `additionalProperties: false`.
   */
  responseSchema?: Record<string, unknown>;
  /** Let Claude research the web (manuals, forums, videos) before answering. */
  webSearch?: boolean;
  /** Adds that machine's past signed-off repairs and root causes (read server-side). */
  machineId?: string;
}

export interface ClaudeSource {
  url: string;
  title: string;
}

const claudeJsonFn = httpsCallable<
  { prompt: string } & ClaudeJsonOptions,
  { result: unknown; sources?: ClaudeSource[] }
>(functions, 'claudeJson', { timeout: 300_000 });

/**
 * Calls Claude via the `claudeJson` Cloud Function and returns the parsed
 * JSON response (or the plain text reply when no responseSchema is given).
 * Throws if AI is disabled or the call fails — callers are expected to fall
 * back to a non-AI path.
 */
export async function generateClaudeJson<T>(prompt: string, options: ClaudeJsonOptions = {}): Promise<T> {
  return (await generateClaudeJsonWithSources<T>(prompt, options)).result;
}

/** Same as generateClaudeJson, plus the web sources Claude searched (when webSearch is on). */
export async function generateClaudeJsonWithSources<T>(
  prompt: string,
  options: ClaudeJsonOptions = {},
): Promise<{ result: T; sources: ClaudeSource[] }> {
  if (!isClaudeEnabled()) {
    throw new Error('AI is disabled (VITE_DISABLE_AI=1)');
  }
  const res = await claudeJsonFn({ prompt, ...options });
  return { result: res.data.result as T, sources: res.data.sources ?? [] };
}
