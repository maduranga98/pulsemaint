const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const { getFirestore } = require("firebase-admin/firestore");
const logger = require("firebase-functions/logger");
const { Anthropic } = require("@anthropic-ai/sdk");

const anthropicApiKey = defineSecret("ANTHROPIC_API_KEY");

const db = getFirestore("default");

const CLAUDE_MODEL = "claude-sonnet-5";
const MAX_TOKENS = 4096;
const MAX_PROMPT_CHARS = 20000;
const MAX_SYSTEM_CHARS = 4000;
const MAX_SCHEMA_CHARS = 4000;

/**
 * Server-side proxy for the app's Claude calls (audit/breakdown root-cause
 * suggestions and meaning-aware translation). Keeps ANTHROPIC_API_KEY in
 * Secret Manager instead of shipping it in the browser bundle.
 *
 * Only signed-in users with an app profile may call it, and prompt/schema
 * sizes plus max_tokens are capped so the key can't be used as a general
 * purpose LLM endpoint. Returns `{ result }` — the parsed JSON object (when a
 * responseSchema is given) or the plain text reply.
 */
exports.claudeJson = onCall({ secrets: [anthropicApiKey], timeoutSeconds: 120 }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Must be authenticated");

  const { prompt, systemInstruction, responseSchema } = request.data ?? {};
  if (typeof prompt !== "string" || !prompt.trim() || prompt.length > MAX_PROMPT_CHARS) {
    throw new HttpsError("invalid-argument", "prompt must be a non-empty string under the size limit");
  }
  if (systemInstruction !== undefined && (typeof systemInstruction !== "string" || systemInstruction.length > MAX_SYSTEM_CHARS)) {
    throw new HttpsError("invalid-argument", "systemInstruction is invalid");
  }
  if (responseSchema !== undefined && (typeof responseSchema !== "object" || responseSchema === null || JSON.stringify(responseSchema).length > MAX_SCHEMA_CHARS)) {
    throw new HttpsError("invalid-argument", "responseSchema is invalid");
  }

  const userSnap = await db.collection("users").doc(request.auth.uid).get();
  if (!userSnap.exists) throw new HttpsError("permission-denied", "No app profile for this user");

  const client = new Anthropic({ apiKey: anthropicApiKey.value() });

  let response;
  try {
    response = await client.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: MAX_TOKENS,
      messages: [{ role: "user", content: prompt }],
      output_config: {
        effort: "low",
        ...(responseSchema ? { format: { type: "json_schema", schema: responseSchema } } : {}),
      },
      ...(systemInstruction ? { system: systemInstruction } : {}),
    });
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) {
      throw new HttpsError("resource-exhausted", "AI provider rate limit reached");
    }
    if (err instanceof Anthropic.APIError) {
      logger.error("Claude API error", { status: err.status, message: err.message });
      throw new HttpsError("unavailable", "AI provider request failed");
    }
    logger.error("Claude request failed", err);
    throw new HttpsError("internal", "AI request failed");
  }

  if (response.stop_reason === "refusal" || response.stop_reason === "max_tokens") {
    throw new HttpsError("unavailable", `AI response incomplete (${response.stop_reason})`);
  }

  const text = response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("");
  if (!text) throw new HttpsError("unavailable", "AI returned no content");

  if (!responseSchema) return { result: text };
  try {
    return { result: JSON.parse(text) };
  } catch {
    throw new HttpsError("unavailable", "AI returned invalid JSON");
  }
});
