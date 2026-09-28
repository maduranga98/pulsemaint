const { onDocumentCreated, onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { FieldValue } = require("firebase-admin/firestore");
const logger = require("firebase-functions/logger");
const { brandedEmail, sendEmail, platformSmtpPassword } = require("../lib/mailer");
const { db, PLATFORM_ALERT_EMAIL } = require("./platformAccess");

const APP_URL = "https://app.firmicore.com";

/**
 * In-app bell notification for the requesting company's admins (same
 * notifications collection / targeting the rest of FirmiCore uses).
 */
async function notifyCompanyAdmins(requestId, req, message) {
  await db.collection("notifications").add({
    companyId: req.companyId,
    type: "request",
    severity: "medium",
    message,
    linkTo: `/app/support-requests?open=${requestId}`,
    recipientRoles: ["admin"],
    targetRoles: ["admin"],
    recipientUserIds: req.createdBy ? [req.createdBy] : [],
    targetUserIds: req.createdBy ? [req.createdBy] : [],
    actorName: "FirmiCore team",
    readBy: [],
    read: false,
    timestamp: FieldValue.serverTimestamp(),
  });
}

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[ch]);
}

/** A company admin sent feedback or a special request → alert Lumora Ventures. */
exports.onSupportRequestCreated = onDocumentCreated(
  { document: "supportRequests/{requestId}", database: "default", secrets: [platformSmtpPassword] },
  async (event) => {
    const r = event.data?.data();
    if (!r) return;
    const html = brandedEmail(`<p><strong>${escapeHtml(r.companyName)}</strong> sent a new <strong>${escapeHtml(r.type)}</strong> request.</p>
<p><strong>${escapeHtml(r.subject)}</strong></p>
<p style="white-space:pre-wrap">${escapeHtml(r.message)}</p>
<p style="color:#64748b;font-size:13px">From ${escapeHtml(r.createdByName)} &lt;${escapeHtml(r.createdByEmail)}&gt;</p>
<p><a href="${APP_URL}/platform/requests/${event.params.requestId}">Open in the platform console</a></p>`);
    try {
      await sendEmail({
        to: PLATFORM_ALERT_EMAIL,
        subject: `[FirmiCore ${r.type}] ${r.companyName}: ${r.subject}`,
        html,
        ...(r.createdByEmail ? { replyTo: r.createdByEmail } : {}),
      });
    } catch (err) {
      logger.error("onSupportRequestCreated email failed", err);
    }
  },
);

/** Lumora Ventures replied to a request → email the company admin who raised it. */
exports.onSupportMessageCreated = onDocumentCreated(
  { document: "supportRequests/{requestId}/messages/{messageId}", database: "default", secrets: [platformSmtpPassword] },
  async (event) => {
    const m = event.data?.data();
    if (!m || m.authorType !== "lumora") return;
    const req = (await db.collection("supportRequests").doc(event.params.requestId).get()).data();
    if (!req) return;
    try {
      await notifyCompanyAdmins(event.params.requestId, req, `FirmiCore team replied to "${req.subject}"`);
    } catch (err) {
      logger.error("onSupportMessageCreated notification failed", err);
    }
    if (!req.createdByEmail) return;
    const html = brandedEmail(`<p>Lumora Ventures replied to your request <strong>${escapeHtml(req.subject)}</strong>:</p>
<p style="white-space:pre-wrap">${escapeHtml(m.body)}</p>
<p><a href="${APP_URL}/app/support-requests">View the conversation in FirmiCore</a></p>`);
    try {
      await sendEmail({ to: req.createdByEmail, subject: `Re: ${req.subject}`, html, replyTo: PLATFORM_ALERT_EMAIL });
    } catch (err) {
      logger.error("onSupportMessageCreated email failed", err);
    }
  },
);

const STATUS_LABEL = { open: "open", in_progress: "in progress", resolved: "resolved", closed: "closed" };

/** Lumora changed a request's status → bell notification for the company's admins. */
exports.onSupportRequestStatusChanged = onDocumentUpdated(
  { document: "supportRequests/{requestId}", database: "default" },
  async (event) => {
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();
    if (!before || !after || before.status === after.status) return;
    try {
      await notifyCompanyAdmins(event.params.requestId, after, `Your request "${after.subject}" is now ${STATUS_LABEL[after.status] ?? after.status}`);
    } catch (err) {
      logger.error("onSupportRequestStatusChanged notification failed", err);
    }
  },
);
