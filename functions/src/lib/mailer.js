const nodemailer = require("nodemailer");
const logger = require("firebase-functions/logger");

// Shared SMTP transport (same account used by sendInvitationEmail).
const transporter = nodemailer.createTransport({
  host: "mail.spacemail.com",
  port: 465,
  secure: true,
  auth: {
    user: "hello@feedsolve.com",
    pass: "2_qY5u9z",
  },
});

/**
 * Wrap body HTML in the branded email shell.
 * @param {string} bodyHtml inner HTML for the white card body
 * @param {string} [companyName] tenant name to show in the header/footer
 *   instead of the generic "PulseMaint" — supplier-facing emails (POs,
 *   receipts) should read as coming from the company, not the platform.
 * @return {string} full HTML document
 */
function brandedEmail(bodyHtml, companyName) {
  const displayName = companyName || "PulseMaint";
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
 * Send one email; failures are logged, not thrown, so one bad address
 * never blocks the rest of a batch.
 * @param {{to: string, subject: string, html: string, text?: string,
 *   fromName?: string,
 *   attachments?: Array<{filename: string, content: Buffer|string, contentType?: string}>}} options
 * @return {Promise<boolean>} true when sent
 */
async function sendEmail({to, subject, html, text, attachments, fromName}) {
  try {
    await transporter.sendMail({
      from: `"${fromName || "PulseMaint"}" <hello@feedsolve.com>`,
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

module.exports = {transporter, brandedEmail, sendEmail};
