const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {defineSecret} = require("firebase-functions/params");
const {getStorage} = require("firebase-admin/storage");
const {google} = require("googleapis");
const {Anthropic} = require("@anthropic-ai/sdk");
const logger = require("firebase-functions/logger");
const {requireSuperadmin} = require("./platformAccess");

const anthropicApiKey = defineSecret("ANTHROPIC_API_KEY");

const CLAUDE_MODEL = "claude-sonnet-5";
const MAX_AUDIO_BYTES = 100 * 1024 * 1024;
const MAX_TRANSCRIPT_CHARS = 20000;
const POLL_MS = 3000;
const MAX_WAIT_MS = 8 * 60 * 1000;

// Languages tried when the caller doesn't say which one was spoken. Speech-to-
// Text v1 picks the best match among the main language plus up to three
// alternatives — Sri Lankan customers speak Sinhala, Tamil or English.
const AUTO_PRIMARY = "en-US";
const AUTO_ALTERNATIVES = ["si-LK", "ta-LK", "hi-IN"];

const LANGUAGE_NAMES = {
  "en": "English", "si": "Sinhala", "ta": "Tamil", "hi": "Hindi", "es": "Spanish", "fr": "French", "de": "German",
  "zh": "Chinese", "ja": "Japanese", "ar": "Arabic", "bn": "Bengali", "ur": "Urdu",
};

function languageName(code) {
  return LANGUAGE_NAMES[String(code || "").split("-")[0].toLowerCase()] || code || "the spoken language";
}

function encodingFor(path, contentType) {
  const t = `${contentType || ""} ${path}`.toLowerCase();
  if (t.includes("webm")) return "WEBM_OPUS";
  if (t.includes("ogg") || t.includes("opus")) return "OGG_OPUS";
  return null;
}

async function transcribe(gcsUri, encoding, languageHint) {
  const auth = new google.auth.GoogleAuth({scopes: ["https://www.googleapis.com/auth/cloud-platform"]});
  const speech = google.speech({version: "v1", auth});
  const auto = !languageHint || languageHint === "auto";
  const config = {
    encoding,
    languageCode: auto ? AUTO_PRIMARY : languageHint,
    ...(auto ? {alternativeLanguageCodes: AUTO_ALTERNATIVES} : {}),
    enableAutomaticPunctuation: true,
  };
  const {data: op} = await speech.speech.longrunningrecognize({requestBody: {config, audio: {uri: gcsUri}}});
  const started = Date.now();
  let current = op;
  while (!current.done) {
    if (Date.now() - started > MAX_WAIT_MS) throw new HttpsError("deadline-exceeded", "Transcription took too long");
    await new Promise((r) => setTimeout(r, POLL_MS));
    current = (await speech.operations.get({name: op.name})).data;
  }
  if (current.error) throw new Error(current.error.message || "Speech-to-Text failed");
  const results = (current.response && current.response.results) || [];
  const transcript = results.map((r) => (r.alternatives && r.alternatives[0] && r.alternatives[0].transcript) || "").join(" ").trim();
  const languageCode = (results.find((r) => r.languageCode) || {}).languageCode || config.languageCode;
  return {transcript, languageCode};
}

async function summarize(transcript, languageCode) {
  const apiKey = String(anthropicApiKey.value() || "").trim().replace(/^["']|["']$/g, "").trim();
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY secret is empty");
  const client = new Anthropic({apiKey});
  const lang = languageName(languageCode);
  const response = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 2048,
    system: "You summarise sales phone calls for FirmiCore, a maintenance-management (CMMS) software company. " +
      `The call transcript is in ${lang}. Write the summary and every list item in ${lang} — do not translate it to English. ` +
      "Be faithful: only include what the customer actually said; never invent needs, prices or dates.",
    messages: [{
      role: "user",
      content: "Summarise this call. 'summary' is 2-4 sentences on what the customer wanted and how the call went. " +
        "'requirements' lists each specific need, question or objection they raised (empty if none). " +
        "'followUps' lists agreed next steps, dates or promises (empty if none).\n\nTranscript:\n" + transcript.slice(0, MAX_TRANSCRIPT_CHARS),
    }],
    output_config: {
      effort: "low",
      format: {
        type: "json_schema",
        schema: {
          type: "object",
          properties: {
            summary: {type: "string"},
            requirements: {type: "array", items: {type: "string"}},
            followUps: {type: "array", items: {type: "string"}},
          },
          required: ["summary", "requirements", "followUps"],
          additionalProperties: false,
        },
      },
    },
  });
  const text = (response.content.find((b) => b.type === "text") || {}).text || "{}";
  return JSON.parse(text);
}

/**
 * Transcribes a recorded sales call (already uploaded to Storage by the
 * console) and summarises what the customer needs, in the language that was
 * spoken. Superadmin only. The audio itself is kept by the client on the lead's
 * activity record; this returns text only.
 */
exports.platformTranscribeCall = onCall(
    {secrets: [anthropicApiKey], timeoutSeconds: 540, memory: "512MiB"},
    async (request) => {
      requireSuperadmin(request);
      const {leadId, storagePath, languageHint} = request.data || {};
      if (typeof leadId !== "string" || !leadId || typeof storagePath !== "string" ||
        !storagePath.startsWith(`platformLeadCalls/${leadId}/`) || storagePath.includes("..")) {
        throw new HttpsError("invalid-argument", "Invalid recording path");
      }
      if (languageHint !== undefined && languageHint !== null && (typeof languageHint !== "string" || languageHint.length > 12)) {
        throw new HttpsError("invalid-argument", "Invalid language");
      }

      const file = getStorage().bucket().file(storagePath);
      const [exists] = await file.exists();
      if (!exists) throw new HttpsError("not-found", "Recording not found");
      const [meta] = await file.getMetadata();
      if (Number(meta.size) > MAX_AUDIO_BYTES) throw new HttpsError("invalid-argument", "Recording is too large");
      const encoding = encodingFor(storagePath, meta.contentType);
      if (!encoding) throw new HttpsError("failed-precondition", "This recording format can't be transcribed (use Chrome, Edge or Firefox)");

      let transcribed;
      try {
        transcribed = await transcribe(`gs://${file.bucket.name}/${storagePath}`, encoding, languageHint);
      } catch (err) {
        if (err instanceof HttpsError) throw err;
        logger.error("platformTranscribeCall: speech-to-text failed", {storagePath, err: String(err)});
        throw new HttpsError("internal", "Speech-to-Text failed — check that the Cloud Speech-to-Text API is enabled for the project");
      }
      if (!transcribed.transcript) {
        return {transcript: "", languageCode: transcribed.languageCode, languageName: languageName(transcribed.languageCode), summary: "", requirements: [], followUps: []};
      }

      let summary = {summary: "", requirements: [], followUps: []};
      try {
        summary = await summarize(transcribed.transcript, transcribed.languageCode);
      } catch (err) {
        logger.error("platformTranscribeCall: summary failed", {storagePath, err: String(err)});
      }
      return {
        transcript: transcribed.transcript,
        languageCode: transcribed.languageCode,
        languageName: languageName(transcribed.languageCode),
        summary: summary.summary || "",
        requirements: summary.requirements || [],
        followUps: summary.followUps || [],
      };
    },
);
