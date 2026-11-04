/**
 * Translates the free text on a department display board (fault descriptions,
 * work order descriptions, PM names) into the viewer's language, so the board
 * shows one language. Each distinct text is translated once per language and
 * cached in `displayTranslations` (server-only), so a screen that refreshes
 * every 30 s costs nothing after the first load. Uses the company's own AI
 * credits like every other AI feature; when AI is off for the plan, out of
 * credits, slow or failing, the board simply shows the original text.
 */

const {defineSecret} = require("firebase-functions/params");
const {Anthropic} = require("@anthropic-ai/sdk");
const logger = require("firebase-functions/logger");

const {consumeAiQuota, refundAiCredits} = require("../ai/aiUsageLimit");
const {companyHasFeature, companyAiCredits} = require("../lib/planFeatures");
const {LANGUAGE_NAMES, translationId} = require("./displayLogic");

const anthropicApiKey = defineSecret("ANTHROPIC_API_KEY");

const CLAUDE_MODEL = "claude-sonnet-5";
const MAX_NEW_TEXTS = 40;
const PROVIDER_TIMEOUT_MS = 25000;
const CREDIT_COST = 1;

/**
 * @param {object} db Firestore
 * @param {{companyId:string,token:string,lang:string,texts:string[]}} input what to translate
 * @return {Promise<Map<string,string>>} source text to translation (only the ones that could be translated)
 */
async function translateDisplayTexts(db, {companyId, token, lang, texts}) {
  const result = new Map();
  if (!texts.length) return result;
  const col = db.collection("displayTranslations");

  const refs = texts.map((t) => col.doc(translationId(lang, t)));
  const snaps = await db.getAll(...refs);
  const missing = [];
  snaps.forEach((snap, i) => {
    const out = snap.exists ? snap.get("text") : null;
    if (typeof out === "string" && out) result.set(texts[i], out);
    else missing.push(texts[i]);
  });
  if (!missing.length) return result;

  const batch = missing.slice(0, MAX_NEW_TEXTS);
  try {
    if (!(await companyHasFeature(companyId, "aiAssist"))) return result;
    await consumeAiQuota(db, {uid: `display_${token.slice(0, 16)}`, companyId}, new Date(), await companyAiCredits(companyId), CREDIT_COST);
  } catch (err) {
    logger.info("display translation skipped", {companyId, reason: String(err && err.message ? err.message : err).slice(0, 200)});
    return result;
  }

  const apiKey = String(anthropicApiKey.value() || "").trim().replace(/^["']|["']$/g, "").trim();
  if (!apiKey) {
    await refundAiCredits(db, {companyId}, new Date(), CREDIT_COST);
    return result;
  }
  const client = new Anthropic({apiKey});
  const language = LANGUAGE_NAMES[lang];
  try {
    const response = await client.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 2048,
      system: `You translate short maintenance notes for a factory display screen into ${language}. ` +
        "Keep machine names, codes, part numbers, numbers and units exactly as written. " +
        `If a note is already in ${language}, return it unchanged. Do not add anything. ` +
        "Return the translations in the same order as the notes.",
      messages: [{role: "user", content: JSON.stringify(batch)}],
      output_config: {
        effort: "low",
        format: {
          type: "json_schema",
          schema: {
            type: "object",
            properties: {translations: {type: "array", items: {type: "string"}}},
            required: ["translations"],
            additionalProperties: false,
          },
        },
      },
    }, {timeout: PROVIDER_TIMEOUT_MS});
    const text = response.content.filter((b) => b.type === "text").map((b) => b.text).join("");
    const parsed = JSON.parse(text);
    const out = parsed && parsed.translations;
    if (!Array.isArray(out) || out.length !== batch.length) throw new Error("translation count mismatch");
    const write = db.batch();
    batch.forEach((source, i) => {
      const translated = typeof out[i] === "string" ? out[i].trim().slice(0, 300) : "";
      if (!translated) return;
      result.set(source, translated);
      write.set(col.doc(translationId(lang, source)), {companyId, lang, text: translated, createdAt: new Date()});
    });
    await write.commit();
  } catch (err) {
    await refundAiCredits(db, {companyId}, new Date(), CREDIT_COST);
    logger.warn("display translation failed", {companyId, err: String(err && err.message ? err.message : err).slice(0, 300)});
  }
  return result;
}

module.exports = {translateDisplayTexts, anthropicApiKey};
