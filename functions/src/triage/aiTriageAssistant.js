const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {defineSecret} = require("firebase-functions/params");
const logger = require("firebase-functions/logger");

// The Anthropic API key must never sit in the frontend bundle (PMGR-022) —
// it's held here as a Cloud Functions secret and only ever used server-side.
const anthropicApiKey = defineSecret("ANTHROPIC_API_KEY");

const SYSTEM_PROMPT = `You are PulseMaint's AI Triage Assistant, helping plant maintenance staff
quickly diagnose equipment problems before a technician is dispatched.

Guidelines:
- Be concise and actionable — numbered steps, not essays.
- Ask a clarifying question only if the problem description is too vague to triage at all.
- Always recommend stopping and escalating to a supervisor for anything that looks
  safety-critical (electrical, pressure, moving parts, chemical exposure).
- You do not have access to live sensor data or this specific machine's history —
  give general troubleshooting guidance, and say so if the user asks for something
  only a technician on-site could determine.`;

const MAX_HISTORY_MESSAGES = 12;

exports.aiTriageAssistant = onCall({secrets: [anthropicApiKey]}, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Must be authenticated.");

  const {message, history, machineName, categoryTitle} = request.data || {};
  if (!message || typeof message !== "string" || !message.trim()) {
    throw new HttpsError("invalid-argument", "message is required.");
  }

  const priorMessages = Array.isArray(history)
    ? history
        .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
        .slice(-MAX_HISTORY_MESSAGES)
        .map((m) => ({role: m.role, content: m.content}))
    : [];

  const contextLine = [
    machineName ? `Machine: ${machineName}` : null,
    categoryTitle ? `Category: ${categoryTitle}` : null,
  ].filter(Boolean).join(" | ");

  const userContent = contextLine ? `[${contextLine}]\n${message.trim()}` : message.trim();

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": anthropicApiKey.value(),
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: [...priorMessages, {role: "user", content: userContent}],
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      logger.error("aiTriageAssistant: Anthropic API error", {status: response.status, text});
      throw new HttpsError("internal", "AI Triage Assistant is temporarily unavailable.");
    }

    const data = await response.json();
    const reply = Array.isArray(data.content)
      ? data.content.filter((block) => block.type === "text").map((block) => block.text).join("\n").trim()
      : "";

    if (!reply) {
      throw new HttpsError("internal", "AI Triage Assistant returned an empty response.");
    }

    return {reply};
  } catch (err) {
    if (err instanceof HttpsError) throw err;
    logger.error("aiTriageAssistant failed", err);
    throw new HttpsError("internal", "AI Triage Assistant is temporarily unavailable.");
  }
});
