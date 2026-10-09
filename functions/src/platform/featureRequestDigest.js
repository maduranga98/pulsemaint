const { onSchedule } = require("firebase-functions/v2/scheduler");
const { Timestamp } = require("firebase-admin/firestore");
const logger = require("firebase-functions/logger");
const { brandedEmail, sendEmail, platformSmtpPassword } = require("../lib/mailer");
const { db } = require("./platformAccess");

/** Who gets the daily list of new feature requests / bugs. */
const FEATURE_DIGEST_EMAIL = process.env.FEATURE_DIGEST_EMAIL || "madurangapgunasekara@gmail.com";
const APP_URL = "https://app.firmicore.com";
const DAY = 86_400_000;

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[ch]);

/** One line of the plain-text list. */
function textLine(r, i) {
  const who = [r.companyName && `Company: ${r.companyName}`, r.leadName && `Lead: ${r.leadName}`].filter(Boolean).join(" · ");
  return [
    `${i + 1}. [${r.type === "bug" ? "Bug" : "Feature"}] ${r.title || "(no title)"}`,
    who && `   ${who}`,
    r.description && `   ${r.description.replace(/\s+/g, " ").slice(0, 500)}`,
    r.createdByEmail && `   Added by ${r.createdByEmail}`,
  ].filter(Boolean).join("\n");
}

/**
 * Daily: emails the list of feature requests / bugs added since the last
 * digest (type, title, company/lead if set). No new requests → no email.
 * The watermark lives in platformMeta/featureRequestDigest.
 */
exports.platformFeatureRequestDigest = onSchedule(
  { schedule: "0 20 * * *", timeZone: "Asia/Colombo", secrets: [platformSmtpPassword] },
  async () => {
    const metaRef = db.collection("platformMeta").doc("featureRequestDigest");
    const meta = await metaRef.get();
    const now = Date.now();
    const since = meta.get("sentThrough")?.toMillis?.() ?? now - DAY;

    const snap = await db.collection("platformFeatureRequests")
      .where("createdAt", ">", Timestamp.fromMillis(since))
      .where("createdAt", "<=", Timestamp.fromMillis(now))
      .orderBy("createdAt", "asc")
      .get();
    if (snap.empty) {
      logger.info("platformFeatureRequestDigest: no new requests, no email");
      await metaRef.set({ sentThrough: Timestamp.fromMillis(now), lastCheckedAt: Timestamp.fromMillis(now) }, { merge: true });
      return;
    }

    const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const bugs = rows.filter((r) => r.type === "bug").length;
    const features = rows.length - bugs;
    const summary = [features && `${features} feature request${features === 1 ? "" : "s"}`, bugs && `${bugs} bug${bugs === 1 ? "" : "s"}`].filter(Boolean).join(" and ");

    const text = `FirmiCore — new feature requests (${summary})\n\n${rows.map(textLine).join("\n\n")}\n\nOpen them: ${APP_URL}/platform/feature-requests\n`;
    const items = rows.map((r) => {
      const who = [r.companyName && `Company: ${esc(r.companyName)}`, r.leadName && `Lead: ${esc(r.leadName)}`].filter(Boolean).join(" · ");
      return `<li style="margin-bottom:10px"><strong>[${r.type === "bug" ? "Bug" : "Feature"}]</strong> ${esc(r.title || "(no title)")}`
        + (who ? `<br><span style="color:#475569">${who}</span>` : "")
        + (r.description ? `<br><span style="color:#64748b">${esc(r.description.slice(0, 500))}</span>` : "")
        + "</li>";
    }).join("");
    const html = brandedEmail(`<p>New in the last day: <strong>${summary}</strong>.</p><ol style="padding-left:18px">${items}</ol>
<p><a href="${APP_URL}/platform/feature-requests">Open Feature requests</a></p>`);

    const sent = await sendEmail({ to: FEATURE_DIGEST_EMAIL, subject: `FirmiCore new feature requests: ${summary}`, html, text });
    if (!sent) throw new Error("Feature request digest email failed"); // watermark unchanged → tomorrow's digest includes these
    await metaRef.set({ sentThrough: Timestamp.fromMillis(now), lastSentAt: Timestamp.fromMillis(now), lastCount: rows.length }, { merge: true });
    logger.info(`platformFeatureRequestDigest sent ${rows.length} requests`);
  },
);
