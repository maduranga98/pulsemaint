const nodemailer = require("nodemailer");
const logger = require("firebase-functions/logger");
const {getFirestore} = require("firebase-admin/firestore");

const db = getFirestore("default");

// Shared SMTP transport (same account used by sendInvitationEmail) — the
// platform default used for any company that hasn't configured their own
// mailbox via Settings → Email Sending.
const transporter = nodemailer.createTransport({
  host: "mail.spacemail.com",
  port: 465,
  secure: true,
  auth: {
    user: "hello@feedsolve.com",
    pass: "2_qY5u9z",
  },
});

const transporterCache = new Map();

/**
 * Looks up a company's own SMTP settings (set via setCompanySmtpSettings)
 * and returns a ready-to-use transporter + from-address for it, or null if
 * the company hasn't configured one — callers should fall back to the
 * shared platform transporter/from-address in that case.
 * @param {string} companyId
 * @return {Promise<{transporter: import('nodemailer').Transporter, fromAddress: string} | null>}
 */
async function getCompanyTransport(companyId) {
  if (!companyId) return null;
  try {
    const snap = await db.doc(`companies/${companyId}/private/smtp`).get();
    if (!snap.exists) return null;
    const cfg = snap.data();
    if (!cfg.host || !cfg.port || !cfg.user || !cfg.pass) return null;

    const cacheKey = `${companyId}:${cfg.host}:${cfg.port}:${cfg.user}`;
    let t = transporterCache.get(cacheKey);
    if (!t) {
      t = nodemailer.createTransport({
        host: cfg.host,
        port: cfg.port,
        secure: !!cfg.secure,
        auth: {user: cfg.user, pass: cfg.pass},
      });
      transporterCache.set(cacheKey, t);
    }
    return {transporter: t, fromAddress: cfg.user};
  } catch (err) {
    logger.warn(`Could not load SMTP settings for company ${companyId}, falling back to platform mailbox`, err);
    return null;
  }
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
 * Send one email; failures are logged, not thrown, so one bad address
 * never blocks the rest of a batch.
 * @param {{to: string, subject: string, html: string, text?: string,
 *   fromName?: string, replyTo?: string, companyId?: string,
 *   attachments?: Array<{filename: string, content: Buffer|string, contentType?: string}>}} options
 *   `companyId`, when given, sends through that company's own configured
 *   SMTP mailbox (Settings → Email Sending) instead of the shared platform
 *   one — falling back to the platform mailbox if none is configured.
 * @return {Promise<boolean>} true when sent
 */
async function sendEmail({to, subject, html, text, attachments, fromName, replyTo, companyId}) {
  const custom = await getCompanyTransport(companyId);
  const activeTransporter = custom ? custom.transporter : transporter;
  const fromAddress = custom ? custom.fromAddress : "hello@feedsolve.com";
  try {
    await activeTransporter.sendMail({
      from: `"${fromName || "FirmiCore"}" <${fromAddress}>`,
      // Only needed on the shared mailbox, where a reply must be routed
      // back to the company's own registered email rather than
      // disappearing into hello@feedsolve.com. Sending through the
      // company's own mailbox already makes replies land there naturally.
      ...(!custom && replyTo ? {replyTo} : {}),
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

module.exports = {transporter, brandedEmail, sendEmail, getCompanyTransport};
