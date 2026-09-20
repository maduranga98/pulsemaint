const CLAUDE_MODEL = 'claude-sonnet-5';
const CLAUDE_URL = 'https://api.anthropic.com/v1/messages';
const CLAUDE_MAX_TOKENS = 1024;

export function hasClaudeKey(): boolean {
  return Boolean(import.meta.env.VITE_ANTHROPIC_API_KEY);
}

interface ClaudeJsonOptions {
  systemInstruction?: string;
  /** JSON schema the response must match — enforced via a forced tool call. */
  responseSchema?: Record<string, unknown>;
}

/**
 * Calls the Claude (Anthropic) Messages API and returns the parsed JSON
 * response. When a responseSchema is given, the call forces a single tool
 * invocation matching that schema so the reply is always structured JSON
 * rather than free text. Throws if the key is missing, the request fails,
 * or the response isn't valid JSON — callers are expected to fall back to a
 * non-AI path.
 */
export async function generateClaudeJson<T>(prompt: string, options: ClaudeJsonOptions = {}): Promise<T> {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('VITE_ANTHROPIC_API_KEY is not set');
  }

  const body: Record<string, unknown> = {
    model: CLAUDE_MODEL,
    max_tokens: CLAUDE_MAX_TOKENS,
    messages: [{ role: 'user', content: prompt }],
    ...(options.systemInstruction ? { system: options.systemInstruction } : {}),
  };

  if (options.responseSchema) {
    body.tools = [
      {
        name: 'respond',
        description: 'Return the answer in the required structured shape.',
        input_schema: options.responseSchema,
      },
    ];
    body.tool_choice = { type: 'tool', name: 'respond' };
  }

  const res = await fetch(CLAUDE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => res.statusText);
    throw new Error(`Claude API error (${res.status}): ${errText}`);
  }

  const data = await res.json();

  if (options.responseSchema) {
    const toolUse = data?.content?.find((block: { type: string }) => block.type === 'tool_use');
    if (!toolUse?.input) {
      throw new Error('Claude API returned no tool_use content');
    }
    return toolUse.input as T;
  }

  const text = data?.content?.find((block: { type: string }) => block.type === 'text')?.text;
  if (typeof text !== 'string') {
    throw new Error('Claude API returned no content');
  }
  return JSON.parse(text) as T;
}
