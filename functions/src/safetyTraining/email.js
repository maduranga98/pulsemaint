// The "safety training required" email sent to a contractor team member.
// Pure (no firebase imports) so it can be unit tested — see
// src/lib/__tests__/contractorSafety.test.ts.

const {MAX_ATTEMPTS} = require("./logic");

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (ch) => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;"})[ch]);
}

function formatDue(ms, timeZone) {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      dateStyle: "full",
      timeStyle: "short",
      timeZone,
    }).format(new Date(ms)) + ` (${timeZone})`;
  } catch {
    return new Date(ms).toISOString();
  }
}

/**
 * @param {object} inv invite data
 * @param {string} link the team member's public form link
 * @param {{companyName: string, plantName: string, timezone: string}} ctx
 * @param {number} dueAtMs link closes at this time
 * @return {{html: string, text: string}} HTML body (without the branded shell) and plain-text alternative
 */
function buildInviteEmail(inv, link, ctx, dueAtMs) {
  const dueText = formatDue(dueAtMs, ctx.timezone);
  const max = inv.maxAttempts || MAX_ATTEMPTS;
  const rows = [
    ["Training", inv.moduleTitle],
    ["Company", ctx.companyName + (ctx.plantName ? ` — ${ctx.plantName}` : "")],
    ["Your company", inv.contractorName],
    ["Assigned by", inv.assignedByName || "Safety team"],
    ["Complete before", dueText],
  ].map(([k, v]) => `
        <tr>
          <td style="color:#888;font-size:13px;padding:3px 12px 3px 0;white-space:nowrap;vertical-align:top;">${k}:</td>
          <td style="color:#333;font-size:13px;font-weight:500;padding:3px 0;">${escapeHtml(v)}</td>
        </tr>`).join("");

  // The button is the only place the link appears in the HTML — the raw URL
  // is not repeated underneath it. The plain-text alternative still carries
  // it, since a text-only mail client has no button.
  const html = `
<h2 style="margin:0 0 8px;color:#1a1a1a;font-size:22px;font-weight:600;">Safety training required</h2>
<p style="margin:0 0 20px;color:#555;font-size:15px;line-height:1.6;">
  Hello <strong>${escapeHtml(inv.technicianName)}</strong>, you have been assigned a safety training by
  <strong>${escapeHtml(ctx.companyName)}</strong>. Please complete it before you start work on site.
</p>
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:8px;margin-bottom:24px;">
  <tr><td style="padding:16px 20px;"><table>${rows}</table></td></tr>
</table>
<table width="100%" cellpadding="0" cellspacing="0">
  <tr><td align="center">
    <a href="${escapeHtml(link)}" style="display:inline-block;background:#1A56DB;color:#ffffff;text-decoration:none;padding:14px 40px;border-radius:8px;font-size:15px;font-weight:600;">
      Open safety training form
    </a>
  </td></tr>
</table>
<p style="margin:24px 0 0;color:#666;font-size:13px;line-height:1.6;">
  Open the form, read the training, fill it in and submit. Photos or a voice recording are optional.
  You can submit up to <strong>${max} times</strong> until the due date and time above; after that, or once your
  safety officer signs you off, the form closes. No account or password is needed.
</p>`;

  const text = `Safety training required: "${inv.moduleTitle}" (${ctx.companyName}). ` +
    `Complete it before ${dueText}. You can submit up to ${max} times until then. Open: ${link}`;
  return {html, text};
}

module.exports = {buildInviteEmail, escapeHtml, formatDue};
