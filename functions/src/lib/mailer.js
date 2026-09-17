const nodemailer = require("nodemailer");
const logger = require("firebase-functions/logger");
const {defineSecret} = require("firebase-functions/params");

const PLATFORM_SMTP_HOST = "mail.spacemail.com";
const PLATFORM_SMTP_PORT = 465;
const PLATFORM_FROM_ADDRESS = "support@firmicore.com";

// Password for the shared platform mailbox — set via `firebase functions:secrets:set
// PLATFORM_SMTP_PASSWORD`. Any exported function that (directly or via
// sendEmail) sends email must list this in its `secrets` option or
// `.value()` will throw at runtime.
const platformSmtpPassword = defineSecret("PLATFORM_SMTP_PASSWORD");

// Shared SMTP transport — every email FirmiCore sends (supplier PO/delivery
// emails, invitations, reports, shift notices) goes through this one
// mailbox. Built lazily so it reads the secret only once a function
// invocation actually has it bound.
let platformTransporter = null;
function getPlatformTransporter() {
  if (!platformTransporter) {
    platformTransporter = nodemailer.createTransport({
      host: PLATFORM_SMTP_HOST,
      port: PLATFORM_SMTP_PORT,
      secure: true,
      auth: {
        user: PLATFORM_FROM_ADDRESS,
        pass: platformSmtpPassword.value(),
      },
    });
  }
  return platformTransporter;
}

/**
 * Wrap body HTML in the branded email shell.
 * @param {string} bodyHtml inner HTML for the white card body
 * @param {string} [companyName] tenant name to show in the header/footer
 *   instead of the generic "FirmiCore" — supplier-facing emails (POs,
 *   receipts) should read as coming from the company, not the platform.
 * @return {string} full HTML document
 */
function brandedEmail(bodyHtml, companyName) {
  const displayName = companyName || "FirmiCore";
  return `
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
          <tr>
            <td style="background: linear-gradient(135deg, #0A1628 0%, #1A56DB 100%);padding:32px 40px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;">
                ${displayName}
              </h1>
            </td>
          </tr>
          <tr>
            <td style="padding:40px;">
              ${bodyHtml}
            </td>
          </tr>
          <tr>
            <td style="background:#f8fafc;padding:20px 40px;text-align:center;border-top:1px solid #eee;">
              <p style="margin:0;color:#aaa;font-size:11px;">
                &copy; ${new Date().getFullYear()} ${displayName}. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Send one email through the platform mailbox; failures are logged, not
 * thrown, so one bad address never blocks the rest of a batch.
 * @param {{to: string, subject: string, html: string, text?: string,
 *   fromName?: string, replyTo?: string,
 *   attachments?: Array<{filename: string, content: Buffer|string, contentType?: string}>}} options
 * @return {Promise<boolean>} true when sent
 */
async function sendEmail({to, subject, html, text, attachments, fromName, replyTo}) {
  try {
    await getPlatformTransporter().sendMail({
      from: `"${fromName || "FirmiCore"}" <${PLATFORM_FROM_ADDRESS}>`,
      // A reply should route back to the company's own registered email
      // rather than disappearing into the platform mailbox.
      ...(replyTo ? {replyTo} : {}),
      to,
      subject,
      html,
      text,
      attachments,
    });
    return true;
  } catch (err) {
    logger.error(`Failed to send email to ${to}`, err);
    return false;
  }
}

module.exports = {brandedEmail, sendEmail, platformSmtpPassword};
