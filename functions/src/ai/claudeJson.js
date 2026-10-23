const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const { getFirestore } = require("firebase-admin/firestore");
const logger = require("firebase-functions/logger");
const { Anthropic } = require("@anthropic-ai/sdk");
const { consumeAiQuota, refundAiCredits } = require("./aiUsageLimit");
const { companyHasFeature, companyAiCredits } = require("../lib/planFeatures");
const { requireOwnCompany } = require("../lib/access");

const anthropicApiKey = defineSecret("ANTHROPIC_API_KEY");

const db = getFirestore("default");

const CLAUDE_MODEL = "claude-sonnet-5";
const MAX_TOKENS = 4096;
const MAX_PROMPT_CHARS = 20000;
const MAX_SYSTEM_CHARS = 4000;
const MAX_SCHEMA_CHARS = 4000;
// A suggestion costs 1 AI credit — mirrors AI_CREDIT_COST.standard in src/lib/planLimits.ts.
const CREDIT_COST = 1;

const HISTORY_FETCH_LIMIT = 500;
const HISTORY_PROMPT_ITEMS = 14;
const STOPWORDS = new Set(["the", "and", "was", "were", "has", "have", "had", "that", "this", "with", "from", "when",
  "then", "there", "their", "about", "into", "just", "been", "machine", "what", "happened", "again", "still", "also"]);

function tokens(text) {
  return new Set(String(text || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/)
      .filter((w) => w.length > 3 && !STOPWORDS.has(w)));
}

function overlap(queryTokens, text) {
  if (!queryTokens.size) return 0;
  let n = 0;
  for (const w of tokens(text)) if (queryTokens.has(w)) n++;
  return n;
}

function millis(ts) {
  return (ts && ts.toMillis && ts.toMillis()) || 0;
}

function day(ts) {
  return ts && ts.toDate ? ts.toDate().toISOString().slice(0, 10) : "?";
}

const clip = (v, n = 300) => String(v || "").slice(0, n);

/**
 * The company's own past root-cause records — closed work orders (breakdown
 * and every other type), resolved/closed breakdown tickets and completed 5-Why
 * RCAs — ranked by how well they match the new fault (same machine first,
 * then similar symptoms on other machines). Read with admin rights because
 * technicians can't query other people's records.
 *
 * Strictly company-scoped: every query filters on the caller's own companyId,
 * the machine must belong to it, and a plant-restricted caller only gets their
 * own plant's records, so nothing from another company ever reaches a prompt.
 */
async function rcaHistoryContext(machineId, queryText, profile) {
  const companyId = profile.companyId;
  if (!companyId) return "";
  const plantId = profile.plantId || null;
  let machineName = "";
  if (machineId) {
    const machine = await db.collection("machines").doc(machineId).get();
    const m = machine.exists ? machine.data() : null;
    if (!m || (m.siteId || m.companyId) !== companyId) machineId = null;
    else machineName = m.name || "";
  }
  const q = tokens(queryText);

  const [woSnap, ticketSnap, rcaSnap] = await Promise.all([
    db.collection("workOrders").where("siteId", "==", companyId)
        .where("status", "in", ["SIGNED_OFF", "CLOSED"]).limit(HISTORY_FETCH_LIMIT).get(),
    db.collection("breakdown_tickets").where("siteId", "==", companyId)
        .where("status", "in", ["resolved", "closed"]).limit(HISTORY_FETCH_LIMIT).get(),
    db.collection("rca").where("siteId", "==", companyId)
        .where("status", "==", "completed").limit(HISTORY_FETCH_LIMIT).get(),
  ]);

  const visible = (d) => !plantId || !d.machinePlantId || d.machinePlantId === plantId;
  const items = [];
  const add = (kind, d, when, machine, problem, cause, extra) => {
    if (!cause) return; // only records that carry a recorded root cause teach anything
    const same = machineId && d.machineId === machineId;
    const score = overlap(q, `${problem} ${cause}`) + (same ? 3 : 0);
    if (!score) return;
    items.push({ score, when, same,
      line: `- [${kind}, ${same ? "this machine" : clip(machine, 60)}, ${day(when)}] problem: ${clip(problem)}` +
        `; root cause: ${clip(cause)}${extra ? `; ${extra}` : ""}` });
  };

  woSnap.docs.forEach((doc) => {
    const w = doc.data();
    if (!visible(w)) return;
    add(`WO ${w.woNumber || ""} ${w.woType || ""}`.trim(), w, w.closedAt, w.machineName, w.description,
        [w.rootCause && w.rootCause !== "unknown" ? w.rootCause : "", w.rootCauseDescription].filter(Boolean).join(" — "),
        w.workDoneDescription ? `work done: ${clip(w.workDoneDescription)}` : "");
  });
  ticketSnap.docs.forEach((doc) => {
    const b = doc.data();
    if (!visible(b)) return;
    // Low-severity quick fixes are completed by the technician with no work
    // order and no signer RCA — the technician's findings and completion notes
    // are the record the AI learns from.
    const quickFix = b.completedWithoutWO === true && b.completionNotes;
    const recorded = [b.rootCause && b.rootCause !== "unknown" ? b.rootCause : "", b.rootCauseDescription]
        .filter(Boolean).join(" — ");
    const cause = recorded || (quickFix ?
      [b.technicianFindings, b.attemptedFixes].filter(Boolean).map((v) => clip(v, 200)).join(" — ") ||
        "quick fix by technician" : "");
    add(`breakdown ${b.ticketNumber || ""}${quickFix ? " (low severity, fixed by technician)" : ""}`.trim(), b,
        b.closedAt || b.resolvedAt, b.machineName, b.description, cause,
        [quickFix && `fix done: ${clip(b.completionNotes)}`,
          !quickFix && b.correctiveActions && `corrective: ${clip(b.correctiveActions)}`,
          b.preventiveRecommendations && `preventive: ${clip(b.preventiveRecommendations)}`].filter(Boolean).join("; "));
  });
  rcaSnap.docs.forEach((doc) => {
    const r = doc.data();
    add("5-Why RCA", r, r.updatedAt || r.createdAt, "", r.problem, r.rootCause,
        r.correctiveAction ? `corrective: ${clip(r.correctiveAction)}` : "");
  });

  items.sort((a, b) => b.score - a.score || millis(b.when) - millis(a.when));
  const top = items.slice(0, HISTORY_PROMPT_ITEMS);
  if (!top.length) {
    return "No past root-cause records in this company match this fault yet.";
  }
  return `This company's own past root-cause records${machineName ? ` (machine: ${machineName})` : ""}, best match first:\n${top.map((i) => i.line).join("\n")}`;
}

/**
 * Server-side proxy for the app's Claude calls (audit/breakdown root-cause
 * suggestions and meaning-aware translation). Keeps ANTHROPIC_API_KEY in
 * Secret Manager instead of shipping it in the browser bundle.
 *
 * Only signed-in users with an app profile may call it, and prompt/schema
 * sizes plus max_tokens are capped so the key can't be used as a general
 * purpose LLM endpoint. Returns `{ result }` — the parsed JSON object (when a
 * responseSchema is given) or the plain text reply. `machineId` (+ optional
 * `historyQuery`, the fault description) appends the caller's own company's
 * past root-cause records to the prompt; there is no web research — the AI
 * only learns from that company data.
 */
exports.claudeJson = onCall({ secrets: [anthropicApiKey], timeoutSeconds: 300 }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Must be authenticated");

  const { prompt, systemInstruction, responseSchema, machineId, historyQuery } = request.data ?? {};
  if (typeof prompt !== "string" || !prompt.trim() || prompt.length > MAX_PROMPT_CHARS) {
    throw new HttpsError("invalid-argument", "prompt must be a non-empty string under the size limit");
  }
  if (systemInstruction !== undefined && (typeof systemInstruction !== "string" || systemInstruction.length > MAX_SYSTEM_CHARS)) {
    throw new HttpsError("invalid-argument", "systemInstruction is invalid");
  }
  if (responseSchema !== undefined && (typeof responseSchema !== "object" || responseSchema === null || JSON.stringify(responseSchema).length > MAX_SCHEMA_CHARS)) {
    throw new HttpsError("invalid-argument", "responseSchema is invalid");
  }

  if (historyQuery !== undefined && (typeof historyQuery !== "string" || historyQuery.length > 2000)) {
    throw new HttpsError("invalid-argument", "historyQuery is invalid");
  }
  if (machineId !== undefined && (typeof machineId !== "string" || !machineId || machineId.length > 200)) {
    throw new HttpsError("invalid-argument", "machineId is invalid");
  }

  // Signed-in, non-anonymous, active member of a company (rejects the
  // anonymous QR-page sessions and anyone without an app profile).
  const profile = await requireOwnCompany(request);

  // AI suggestions and translation are on every plan, capped by the plan's
  // monthly AI credits (a running trial follows Starter's credits).
  if (!(await companyHasFeature(profile.companyId, "aiAssist"))) {
    throw new HttpsError("permission-denied", "AI suggestions are not included in your plan. Upgrade to use them.");
  }

  // Per-user (hourly) and per-company (daily) caps — see aiUsageLimit.js.
  const companyId = profile.companyId;
  // Charged up front; refunded below if the provider call fails.
  const creditCost = CREDIT_COST;
  await consumeAiQuota(db, {uid: request.auth.uid, companyId}, new Date(), await companyAiCredits(companyId), creditCost);

  let fullPrompt = prompt;
  if (machineId) {
    const history = await rcaHistoryContext(machineId, historyQuery || prompt, profile).catch((err) => {
      logger.warn("rcaHistoryContext failed", { machineId, err: String(err) });
      return "";
    });
    if (history) fullPrompt = `${prompt}\n\n${history}`;
  }

  // Tolerate a key pasted into Secret Manager with surrounding whitespace,
  // a trailing newline or quotes — all of which the API rejects as invalid.
  const apiKey = String(anthropicApiKey.value() || "").trim().replace(/^["']|["']$/g, "").trim();
  if (!apiKey) throw new HttpsError("failed-precondition", "ANTHROPIC_API_KEY secret is empty");
  const client = new Anthropic({ apiKey });

  const params = {
    model: CLAUDE_MODEL,
    max_tokens: MAX_TOKENS,
    messages: [{ role: "user", content: fullPrompt }],
    output_config: {
      effort: "low",
      ...(responseSchema ? { format: { type: "json_schema", schema: responseSchema } } : {}),
    },
    ...(systemInstruction ? { system: systemInstruction } : {}),
  };

  let response;
  try {
    response = await client.messages.create(params);
  } catch (err) {
    await refundAiCredits(db, {companyId}, new Date(), creditCost);
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

  if (!responseSchema) return { result: text };
  try {
    return { result: JSON.parse(text) };
  } catch {
    throw new HttpsError("unavailable", "AI returned invalid JSON");
  }
});
