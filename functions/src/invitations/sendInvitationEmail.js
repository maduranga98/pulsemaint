const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { getFirestore } = require("firebase-admin/firestore");
const nodemailer = require("nodemailer");
const logger = require("firebase-functions/logger");

const db = getFirestore("default");

const transporter = nodemailer.createTransport({
  host: "mail.spacemail.com",
  port: 465,
  secure: true,
  auth: {
    user: "hello@feedsolve.com",
    pass: "2_qY5u9z",
  },
});

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
    const companyName = companySnap.exists
      ? companySnap.data().name
      : inv.companyName || "Your Company";

    const inviteUrl = `https://pulsemaint.com/invite/${inv.token}`;

    const roleName = (inv.role || "team member").replace(/_/g, " ");

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#f0f4f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f0f4f8;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.07);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #0A1628 0%, #1A56DB 100%);padding:32px 40px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;">
                <span style="color:#ffffff;">Pulse</span><span style="color:#00C2FF;">Maint</span>
              </h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              <h2 style="margin:0 0 8px;color:#1a1a1a;font-size:22px;font-weight:600;">You're invited!</h2>
              <p style="margin:0 0 24px;color:#555;font-size:15px;line-height:1.6;">
                <strong>${inv.invitedByName || "Your administrator"}</strong> has invited you to join
                <strong>${companyName}</strong> on PulseMaint as a
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
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background:#f8fafc;padding:20px 40px;text-align:center;border-top:1px solid #eee;">
              <p style="margin:0;color:#aaa;font-size:11px;">
                &copy; ${new Date().getFullYear()} PulseMaint by FeedSolve. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    try {
      await transporter.sendMail({
        from: '"PulseMaint" <hello@feedsolve.com>',
        to: inv.email,
        subject: `You're invited to join ${companyName} on PulseMaint`,
        html,
        text: `You've been invited to join ${companyName} on PulseMaint as a ${roleName}. Accept your invitation here: ${inviteUrl}`,
      });

      logger.info(`Invitation email sent to ${inv.email}`, { invitationId });

      await db
        .doc(`companies/${companyId}/invitations/${invitationId}`)
        .update({ emailSent: true, emailSentAt: new Date() });

      return { success: true };
    } catch (err) {
      logger.error("Failed to send invitation email", err);
      throw new HttpsError("internal", "Failed to send invitation email.");
    }
  },
);
