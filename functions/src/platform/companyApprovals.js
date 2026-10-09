const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { FieldValue } = require("firebase-admin/firestore");
const logger = require("firebase-functions/logger");
const { brandedEmail, sendEmail, platformSmtpPassword } = require("../lib/mailer");
const { db, PLATFORM_ALERT_EMAIL } = require("./platformAccess");

const APP_URL = "https://app.firmicore.com";

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[ch]);
}

/**
 * New self-registered companies start with approvalStatus "pending" and
 * cannot use FirmiCore until a Lumora superadmin approves them. Companies
 * created before approvals existed have no field and count as approved.
 */
function approvalStatusOf(company) {
  return company?.approvalStatus === "pending" || company?.approvalStatus === "rejected" ? company.approvalStatus : "approved";
}

/** A company registered → bell alert + email to Lumora Ventures. */
exports.onCompanyRegistered = onDocumentCreated(
  { document: "companies/{companyId}", database: "default", secrets: [platformSmtpPassword] },
  async (event) => {
    const c = event.data?.data();
    if (!c || approvalStatusOf(c) !== "pending") return;
    const { companyId } = event.params;
    await db.collection("platformNotifications").doc(`registration_${companyId}`).set({
      type: "registration",
      companyId,
      companyName: c.name ?? null,
      read: false,
      createdAt: FieldValue.serverTimestamp(),
    });
    let admin = { fullName: null, email: null, phone: null };
    if (c.adminUserId) {
      // The admin profile is written right after the company doc; it may not exist yet.
      const snap = await db.doc(`companies/${companyId}/users/${c.adminUserId}`).get();
      if (snap.exists) admin = { fullName: snap.get("fullName") ?? null, email: snap.get("email") ?? null, phone: snap.get("phone") ?? null };
    }
    const html = brandedEmail(`<p>A new company registered on FirmiCore and is waiting for your approval.</p>
<p><strong>${escapeHtml(c.name)}</strong><br>${escapeHtml(c.industry)} · ${escapeHtml(c.country)}</p>
${admin.email ? `<p>Admin: ${escapeHtml(admin.fullName)} &lt;${escapeHtml(admin.email)}&gt;${admin.phone ? ` · ${escapeHtml(admin.phone)}` : ""}</p>` : ""}
<p><a href="${APP_URL}/platform/companies/${companyId}">Review and approve in the platform console</a></p>`);
    try {
      await sendEmail({ to: PLATFORM_ALERT_EMAIL, subject: `[FirmiCore] New registration awaiting approval: ${c.name}`, html, ...(admin.email ? { replyTo: admin.email } : {}) });
    } catch (err) {
      logger.error("onCompanyRegistered email failed", err);
    }
  },
);

/** Tell the company admin their registration was approved or declined. */
async function emailApprovalDecision(company, adminEmail, approved, reason) {
  if (!adminEmail) return;
  const body = approved
    ? `<p>Good news — <strong>${escapeHtml(company.name)}</strong> has been approved on FirmiCore.</p>
<p>You can now <a href="${APP_URL}/login">sign in</a> with the email and password you registered with and set up your workspace.</p>`
    : `<p>Thank you for registering <strong>${escapeHtml(company.name)}</strong> on FirmiCore. We were not able to approve this registration.</p>
${reason ? `<p><strong>Reason:</strong> ${escapeHtml(reason)}</p>` : ""}
<p>If you think this is a mistake, reply to this email or contact ${escapeHtml(PLATFORM_ALERT_EMAIL)}.</p>`;
  try {
    await sendEmail({
      to: adminEmail,
      subject: approved ? "Your FirmiCore account is approved" : "Your FirmiCore registration",
      html: brandedEmail(body),
      replyTo: PLATFORM_ALERT_EMAIL,
    });
  } catch (err) {
    logger.error("approval decision email failed", err);
  }
}

/** Mark the registration bell alert read once it has been decided. */
async function clearRegistrationAlert(companyId) {
  await db.collection("platformNotifications").doc(`registration_${companyId}`).set({ read: true }, { merge: true }).catch(() => {});
}

module.exports = { onCompanyRegistered: exports.onCompanyRegistered, approvalStatusOf, emailApprovalDecision, clearRegistrationAlert };
