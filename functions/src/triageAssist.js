"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const { getFirestore } = require("firebase-admin/firestore");

const ANTHROPIC_API_KEY = defineSecret("ANTHROPIC_API_KEY");

exports.triageAssist = onCall(
  { secrets: [ANTHROPIC_API_KEY] },
  async (req) => {
    if (!req.auth) throw new HttpsError("unauthenticated", "Login required");

    const situation = String(req.data?.situation ?? "").slice(0, 1000);
    if (!situation.trim()) throw new HttpsError("invalid-argument", "situation required");

    const db = getFirestore("default");

    const [woSnap, bdSnap, auditSnap] = await Promise.all([
      db.collection("workOrders").orderBy("createdAt", "desc").limit(20).get(),
      db.collection("breakdowns").orderBy("createdAt", "desc").limit(20).get(),
      db.collection("audits").orderBy("createdAt", "desc").limit(15).get(),
    ]);

    const wos = woSnap.docs.map((d) => d.data());
    const bds = bdSnap.docs.map((d) => d.data());
    const audits = auditSnap.docs.map((d) => d.data());

    const prompt = `You are the FixDesk AI Triage assistant for an oil manufacturing plant.
Use the plant's HISTORICAL DATA to give practical, root-cause-based guidance for the operator's situation.

WORK ORDERS:
${wos.map((w) => `- ${w.machine ?? w.machineName ?? "machine"}: cause "${w.cause ?? w.rootCause ?? ""}" -> fix "${w.fix ?? w.resolution ?? ""}" (${w.downtime ?? ""})`).join("\n")}

PAST BREAKDOWNS:
${bds.map((b) => `- ${b.machine ?? b.machineName ?? "machine"}: "${b.cause ?? b.faultDescription ?? ""}" (${b.impact ?? ""}, repeat:${b.repeat ?? b.isRepeat ?? ""})`).join("\n")}

AUDIT FINDINGS:
${audits.map((a) => `- [${a.sev ?? a.severity ?? ""}] ${a.finding ?? a.description ?? ""}`).join("\n")}

SITUATION: "${situation}"

Return ONLY valid JSON (no markdown fences, no extra text):
{"summary":"one line likely issue","likelyCauses":[".."],"checkNow":[".."],"safeActions":[".."],"doNot":[".."],"basedOn":"which past record this draws from"}`;

    const Anthropic = require("@anthropic-ai/sdk");
    const client = new Anthropic.default({ apiKey: ANTHROPIC_API_KEY.value() });

    const msg = await client.messages.create({
      model: "claude-sonnet-4-5-20250514",
      max_tokens: 900,
      messages: [{ role: "user", content: prompt }],
    });

    const text = (msg.content.find((b) => b.type === "text")?.text) ?? "";
    try {
      const parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
      return parsed;
    } catch {
      throw new HttpsError("internal", "AI returned unparseable output");
    }
  },
);
