const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { getFirestore } = require("firebase-admin/firestore");
const Anthropic = require("@anthropic-ai/sdk");
const logger = require("firebase-functions/logger");

const db = getFirestore("default");

// Read from a plain env var (set via functions/.env.<project-id>, gitignored)
// rather than defineSecret()/Secret Manager. A required-but-unresolved
// Secret Manager binding blocks `firebase deploy --only functions` for
// *every* function in the deploy, not just this one — that's what took this
// function out entirely before. Reading a plain env var never blocks
// deploy; it just leaves the assistant disabled until the key is set.
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "";

const RESPONSE_SCHEMA_DESCRIPTION = `Respond with ONLY a single JSON object (no markdown fences, no prose before or after) matching exactly this shape:
{
  "summary": "one or two sentence summary of the likely situation",
  "likelyCauses": ["most likely root causes, most probable first"],
  "checkNow": ["concrete things to inspect or measure right now"],
  "safeActions": ["safe actions an operator/technician can take immediately"],
  "doNot": ["actions to avoid until a qualified technician is involved"],
  "basedOn": "short note on what this assessment is based on, e.g. 'general industrial maintenance practice' or the machine type if known"
}
Every array must contain 2-5 short, concrete items. Keep each item under 20 words.`;

/**
 * AI Triage Assistant — takes a free-text description of a machine fault or
 * situation and returns structured troubleshooting guidance via the
 * Anthropic API. The frontend (AITriage.tsx) calls this as a callable
 * function; previously there was no backend implementation at all, so the
 * assistant always failed.
 */
exports.triageAssist = onCall(
  { maxInstances: 10, timeoutSeconds: 60 },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Must be signed in.");
    }
    if (!ANTHROPIC_API_KEY) {
      throw new HttpsError(
        "failed-precondition",
        "AI Triage is not configured yet. Ask an admin to set ANTHROPIC_API_KEY for the functions deploy.",
      );
    }

    const situation = (request.data?.situation || "").trim();
    if (!situation) {
      throw new HttpsError("invalid-argument", "situation is required.");
    }
    if (situation.length > 2000) {
      throw new HttpsError("invalid-argument", "situation is too long.");
    }
    const machineId = request.data?.machineId ? String(request.data.machineId) : null;

    let machineContext = "";
    if (machineId) {
      try {
        const machineSnap = await db.doc(`machines/${machineId}`).get();
        if (machineSnap.exists) {
          const m = machineSnap.data();
          machineContext = `\nMachine: ${m.name ?? "Unknown"} (type: ${m.type ?? "unknown"}, manufacturer: ${m.manufacturer ?? "unknown"}).`;
        }
      } catch (err) {
        logger.warn("triageAssist: failed to load machine context", err);
      }
    }

    const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

    let response;
    try {
      response = await client.messages.create({
        model: "claude-opus-4-8",
        max_tokens: 1024,
        output_config: { effort: "medium" },
        system:
          "You are an industrial maintenance triage assistant embedded in a factory maintenance app. " +
          "A floor operator, technician or supervisor describes a machine fault or situation. " +
          "Give practical, safety-first troubleshooting guidance a non-specialist can act on immediately. " +
          RESPONSE_SCHEMA_DESCRIPTION,
        messages: [
          {
            role: "user",
            content: `Situation: ${situation}${machineContext}`,
          },
        ],
      });
    } catch (err) {
      logger.error("triageAssist: Anthropic API call failed", err);
      throw new HttpsError("internal", "AI Triage is unavailable. Try again later.");
    }

    if (response.stop_reason === "refusal") {
      throw new HttpsError("internal", "AI Triage could not analyse this situation.");
    }

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock) {
      throw new HttpsError("internal", "AI Triage returned an empty response.");
    }

    const parsed = parseTriageResponse(textBlock.text);
    if (!parsed) {
      logger.error("triageAssist: could not parse model response", textBlock.text);
      throw new HttpsError("internal", "AI Triage returned an unexpected response.");
    }

    return parsed;
  },
);

function parseTriageResponse(text) {
  const candidates = [text];
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) candidates.push(jsonMatch[0]);

  for (const candidate of candidates) {
    try {
      const data = JSON.parse(candidate);
      return {
        summary: String(data.summary ?? ""),
        likelyCauses: toStringArray(data.likelyCauses),
        checkNow: toStringArray(data.checkNow),
        safeActions: toStringArray(data.safeActions),
        doNot: toStringArray(data.doNot),
        basedOn: String(data.basedOn ?? ""),
      };
    } catch (err) {
      // try next candidate
    }
  }
  return null;
}

function toStringArray(value) {
  if (!Array.isArray(value)) return [];
  return value.map((v) => String(v)).filter(Boolean);
}
