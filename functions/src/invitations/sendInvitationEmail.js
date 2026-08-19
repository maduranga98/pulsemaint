const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { getFirestore } = require("firebase-admin/firestore");
const logger = require("firebase-functions/logger");
const { sendEmail, brandedEmail } = require("../lib/mailer");

const db = getFirestore("default");

exports.sendInvitationEmail = onCall(
  { maxInstances: 5 },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Must be signed in.");
    }

    const { invitationId, companyId } = request.data;
    if (!invitationId || !companyId) {
      throw new HttpsError("invalid-argument", "Missing invitationId or companyId.");
    }

    const invSnap = await db
      .doc(`companies/${companyId}/invitations/${invitationId}`)
      .get();
    if (!invSnap.exists) {
      throw new HttpsError("not-found", "Invitation not found.");
    }

    const inv = invSnap.data();

    const companySnap = await db.doc(`companies/${companyId}`).get();
    const companyData = companySnap.exists ? companySnap.data() : null;
    const companyName = companyData?.name || inv.companyName || "Your Company";
    const companyEmail = companyData?.email || null;

    const inviteUrl = `https://app.firmicore.com/invite/${inv.token}`;

    const roleName = (inv.role || "team member").replace(/_/g, " ");

    const html = `
<h2 style="margin:0 0 8px;color:#1a1a1a;font-size:22px;font-weight:600;">You're invited!</h2>
<p style="margin:0 0 24px;color:#555;font-size:15px;line-height:1.6;">
  <strong>${inv.invitedByName || "Your administrator"}</strong> has invited you to join
  <strong>${companyName}</strong> on FirmiCore as a
  <span style="display:inline-block;background:#EBF5FF;color:#1A56DB;padding:2px 10px;border-radius:4px;font-size:13px;font-weight:600;">${roleName}</span>.
</p>

<table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:8px;margin-bottom:28px;">
  <tr>
    <td style="padding:16px 20px;">
      <table>
        <tr>
          <td style="color:#888;font-size:13px;padding-right:12px;white-space:nowrap;">Company:</td>
          <td style="color:#333;font-size:13px;font-weight:500;">${companyName}</td>
        </tr>
        <tr>
          <td style="color:#888;font-size:13px;padding-right:12px;padding-top:6px;white-space:nowrap;">Role:</td>
          <td style="color:#333;font-size:13px;font-weight:500;padding-top:6px;text-transform:capitalize;">${roleName}</td>
        </tr>
        ${inv.department ? `<tr><td style="color:#888;font-size:13px;padding-right:12px;padding-top:6px;white-space:nowrap;">Department:</td><td style="color:#333;font-size:13px;font-weight:500;padding-top:6px;">${inv.department}</td></tr>` : ""}
        ${inv.jobTitle ? `<tr><td style="color:#888;font-size:13px;padding-right:12px;padding-top:6px;white-space:nowrap;">Job Title:</td><td style="color:#333;font-size:13px;font-weight:500;padding-top:6px;">${inv.jobTitle}</td></tr>` : ""}
      </table>
    </td>
  </tr>
</table>

<table width="100%" cellpadding="0" cellspacing="0">
  <tr>
    <td align="center">
      <a href="${inviteUrl}" style="display:inline-block;background:#1A56DB;color:#ffffff;text-decoration:none;padding:14px 40px;border-radius:8px;font-size:15px;font-weight:600;letter-spacing:0.3px;">
        Accept Invitation
      </a>
    </td>
  </tr>
</table>

<p style="margin:24px 0 0;color:#888;font-size:12px;text-align:center;line-height:1.5;">
  You can sign up with <strong>email &amp; password</strong> or <strong>Google</strong>.
  <br>This invitation expires in 7 days.
</p>

<hr style="border:none;border-top:1px solid #eee;margin:28px 0 16px;">

<p style="margin:0;color:#aaa;font-size:11px;line-height:1.5;">
  If you weren't expecting this invitation, you can safely ignore this email.
  <br>If the button doesn't work, copy and paste this link:<br>
  <a href="${inviteUrl}" style="color:#1A56DB;word-break:break-all;">${inviteUrl}</a>
</p>`;

    const sent = await sendEmail({
      to: inv.email,
      subject: `You're invited to join ${companyName} on FirmiCore`,
      // Mirrors sendPoEmails.js: when the company has its own configured
      // mailbox (Settings → Email Sending), the invite should read as
      // coming from them, not the shared "FirmiCore" platform brand.
      html: brandedEmail(html, companyName),
      text: `You've been invited to join ${companyName} on FirmiCore as a ${roleName}. Accept your invitation here: ${inviteUrl}`,
      fromName: companyName,
      replyTo: companyEmail || undefined,
      companyId,
    });

    if (!sent) {
      logger.error("Failed to send invitation email", { invitationId, companyId });
      throw new HttpsError("internal", "Failed to send invitation email.");
    }

    logger.info(`Invitation email sent to ${inv.email}`, { invitationId });

    await db
      .doc(`companies/${companyId}/invitations/${invitationId}`)
      .update({ emailSent: true, emailSentAt: new Date() });

    return { success: true };
  },
);
