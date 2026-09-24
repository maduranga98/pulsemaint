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
const WEB_SEARCH_MAX_TOKENS = 8192;
const MAX_WEB_SEARCHES = 3;
const CLOSED_WO_STATUSES = new Set(["SIGNED_OFF", "CLOSED"]);

/**
 * Past signed-off repairs on this machine and their root causes — read with
 * admin rights here because technicians can't query other people's WOs.
 * Only for a machine in the caller's own company.
 */
async function machineHistoryContext(machineId, profile) {
  const machine = await db.collection("machines").doc(machineId).get();
  if (!machine.exists) return "";
  const siteId = machine.data().siteId;
  const allowed = [profile.companyId, profile.siteId, ...(profile.siteIds || [])].filter(Boolean);
  if (!allowed.includes(siteId)) return "";
  const snap = await db.collection("workOrders").where("machineId", "==", machineId).get();
  const closed = snap.docs
      .map((d) => d.data())
      .filter((w) => CLOSED_WO_STATUSES.has(w.status))
      .sort((a, b) => ((b.closedAt && b.closedAt.toMillis()) || 0) - ((a.closedAt && a.closedAt.toMillis()) || 0))
      .slice(0, 8);
  if (!closed.length) return "";
  const lines = closed.map((w) => {
    const rca = w.aiRca && w.aiRca.source === "ai" ? w.aiRca : null;
    const cause = rca ? rca.rootCause : [w.rootCause, w.rootCauseDescription].filter(Boolean).join(" — ");
    const date = w.closedAt && w.closedAt.toDate ? w.closedAt.toDate().toISOString().slice(0, 10) : "?";
    return `- ${w.woNumber || "WO"} (${date}, ${w.woType}): problem: ${String(w.description || "").slice(0, 300)}` +
      `; root cause: ${String(cause || "not recorded").slice(0, 300)}` +
      `; work done: ${String(w.workDoneDescription || "").slice(0, 300)}` +
      (rca && rca.preventiveActions && rca.preventiveActions.length ? `; preventive: ${rca.preventiveActions.slice(0, 3).join(" / ")}` : "");
  });
  return `Past signed-off repairs and root-cause analyses on this same machine (most recent first):\n${lines.join("\n")}`;
}

/** First {...} JSON object in a free-text reply (web-search replies can't use structured outputs). */
function extractJson(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("no JSON object in reply");
  return JSON.parse(text.slice(start, end + 1));
}

/**
 * Server-side proxy for the app's Claude calls (audit/breakdown root-cause
 * suggestions and meaning-aware translation). Keeps ANTHROPIC_API_KEY in
 * Secret Manager instead of shipping it in the browser bundle.
 *
 * Only signed-in users with an app profile may call it, and prompt/schema
 * sizes plus max_tokens are capped so the key can't be used as a general
 * purpose LLM endpoint. Returns `{ result, sources }` — the parsed JSON object
 * (when a responseSchema is given) or the plain text reply, plus the web
 * pages searched when `webSearch` is on. `machineId` appends that machine's
 * past signed-off repairs and root causes to the prompt.
 */
exports.claudeJson = onCall({ secrets: [anthropicApiKey], timeoutSeconds: 300 }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Must be authenticated");

  const { prompt, systemInstruction, responseSchema, webSearch, machineId } = request.data ?? {};
  if (typeof prompt !== "string" || !prompt.trim() || prompt.length > MAX_PROMPT_CHARS) {
    throw new HttpsError("invalid-argument", "prompt must be a non-empty string under the size limit");
  }
  if (systemInstruction !== undefined && (typeof systemInstruction !== "string" || systemInstruction.length > MAX_SYSTEM_CHARS)) {
    throw new HttpsError("invalid-argument", "systemInstruction is invalid");
  }
  if (responseSchema !== undefined && (typeof responseSchema !== "object" || responseSchema === null || JSON.stringify(responseSchema).length > MAX_SCHEMA_CHARS)) {
    throw new HttpsError("invalid-argument", "responseSchema is invalid");
  }

  if (webSearch !== undefined && typeof webSearch !== "boolean") {
    throw new HttpsError("invalid-argument", "webSearch must be a boolean");
  }
  if (machineId !== undefined && (typeof machineId !== "string" || !machineId || machineId.length > 200)) {
    throw new HttpsError("invalid-argument", "machineId is invalid");
  }

  const userSnap = await db.collection("users").doc(request.auth.uid).get();
  if (!userSnap.exists) throw new HttpsError("permission-denied", "No app profile for this user");

  let fullPrompt = prompt;
  if (machineId) {
    const history = await machineHistoryContext(machineId, userSnap.data()).catch((err) => {
      logger.warn("machineHistoryContext failed", { machineId, err: String(err) });
      return "";
    });
    if (history) fullPrompt = `${prompt}\n\n${history}`;
  }

  // Tolerate a key pasted into Secret Manager with surrounding whitespace,
  // a trailing newline or quotes — all of which the API rejects as invalid.
  const apiKey = String(anthropicApiKey.value() || "").trim().replace(/^["']|["']$/g, "").trim();
  if (!apiKey) throw new HttpsError("failed-precondition", "ANTHROPIC_API_KEY secret is empty");
  const client = new Anthropic({ apiKey });

  // With web search the reply is free text (structured outputs can't be
  // combined with it), so the schema goes into the system prompt instead and
  // the JSON is pulled out of the final text.
  const system = webSearch && responseSchema ?
    `${systemInstruction || ""}\n\nAfter researching, reply with ONLY one JSON object matching this JSON schema — no prose before or after it:\n${JSON.stringify(responseSchema)}` :
    systemInstruction;
  const params = {
    model: CLAUDE_MODEL,
    max_tokens: webSearch ? WEB_SEARCH_MAX_TOKENS : MAX_TOKENS,
    messages: [{ role: "user", content: fullPrompt }],
    output_config: {
      effort: "low",
      ...(responseSchema && !webSearch ? { format: { type: "json_schema", schema: responseSchema } } : {}),
    },
    ...(webSearch ? { tools: [{ type: "web_search_20260209", name: "web_search", max_uses: MAX_WEB_SEARCHES }] } : {}),
    ...(system ? { system } : {}),
  };

  let response;
  try {
    response = await client.messages.create(params);
    // A long server-side search loop can pause; resume it by sending the
    // paused assistant turn back (no extra user message).
    for (let i = 0; i < 3 && response.stop_reason === "pause_turn"; i++) {
      params.messages = [params.messages[0], { role: "assistant", content: response.content }];
      response = await client.messages.create(params);
    }
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) {
      throw new HttpsError("resource-exhausted", "AI provider rate limit reached");
    }
    if (err instanceof Anthropic.APIError) {
      logger.error("Claude API error", { status: err.status, message: err.message });
      // Surface the provider's reason (e.g. invalid key, no credit, bad
      // request) so the app can show why AI fell back — never the key itself.
      throw new HttpsError("unavailable", `AI provider request failed (${err.status}): ${String(err.message).slice(0, 300)}`);
    }
    logger.error("Claude request failed", err);
    throw new HttpsError("internal", `AI request failed: ${String(err && err.message ? err.message : err).slice(0, 300)}`);
  }

  if (response.stop_reason === "refusal" || response.stop_reason === "max_tokens") {
    throw new HttpsError("unavailable", `AI response incomplete (${response.stop_reason})`);
  }

  const text = response.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("");
  if (!text) throw new HttpsError("unavailable", "AI returned no content");

  // Web pages / videos the model actually searched, for the app to link.
  const sources = [];
  const seen = new Set();
  for (const block of response.content) {
    if (block.type !== "web_search_tool_result" || !Array.isArray(block.content)) continue;
    for (const r of block.content) {
      if (r && r.url && !seen.has(r.url) && sources.length < 8) {
        seen.add(r.url);
        sources.push({ url: r.url, title: r.title || r.url });
      }
    }
  }

  if (!responseSchema) return { result: text, sources };
  try {
    if (!webSearch) return { result: JSON.parse(text), sources };
    // The answer is the text written after the last search — earlier text
    // blocks are the model narrating its research.
    let lastTool = -1;
    response.content.forEach((block, i) => {
      if (block.type !== "text") lastTool = i;
    });
    const finalText = response.content.slice(lastTool + 1)
        .filter((block) => block.type === "text")
        .map((block) => block.text)
        .join("");
    return { result: extractJson(finalText || text), sources };
  } catch {
    throw new HttpsError("unavailable", "AI returned invalid JSON");
  }
});
