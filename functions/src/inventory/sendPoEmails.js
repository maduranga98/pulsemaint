/**
 * sendPoEmails
 * Firestore onCreate trigger on po_notifications/{id}.
 *
 * The PO create/edit/detail screens queue a po_notifications doc whenever a
 * PO changes status. This dispatches supplier-facing emails only — nothing
 * ever goes to the company's own plant_manager/admin inboxes:
 *   - the initial PO email to the supplier — rendered as a full PO document
 *     (company header, supplier/ship-to, item table), no pricing/total,
 *     since the supplier is the one who quotes/sends prices via their
 *     invoice — when the event is "sent" (i.e. actually dispatched to the
 *     supplier, not just approved),
 *   - a priced PO email, the same document now showing the invoice-derived
 *     unit costs/suggested pricing, once the received invoice has been
 *     reviewed (accepted as-is or edited) — event "invoice_priced". Fires
 *     again on every subsequent revision, so pricing corrections reach the
 *     supplier too,
 *   - the delivery receipt confirmation once stock is received, and
 *   - a cancellation notice, with the reason given, when a PO that had
 *     already been sent to the supplier is cancelled — event "cancelled".
 * Every supplier-facing email uses the tenant's own registered company name
 * (never the generic "FirmiCore" platform name).
 */

const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { getFirestore } = require("firebase-admin/firestore");
const logger = require("firebase-functions/logger");
const { brandedEmail, sendEmail } = require("../lib/mailer");
const { getPoEmailStrings, t: interpolate, DEFAULT_LANGUAGE } = require("./poEmailTranslations");

const db = getFirestore("default");

async function companyNameFor(companyId) {
  if (!companyId) return "";
  try {
    const snap = await db.collection("companies").doc(companyId).get();
    if (!snap.exists) return "";
    const data = snap.data() || {};
    return (data.name && data.name.trim()) || (data.tradeName && data.tradeName.trim()) || "";
  } catch (err) {
    logger.warn(`Could not load company ${companyId} for email branding`, err);
    return "";
  }
}

// Fuller company details for the PO document email header — falls back
// gracefully since address/phone/email are optional on the company profile.
async function companyMetaFor(companyId) {
  if (!companyId) return {name: ""};
  try {
    const snap = await db.collection("companies").doc(companyId).get();
    if (!snap.exists) return {name: ""};
    const data = snap.data() || {};
    return {
      name: (data.name && data.name.trim()) || (data.tradeName && data.tradeName.trim()) || "",
      address: data.address || "",
      phone: data.phone || "",
      email: data.email || "",
    };
  } catch (err) {
    logger.warn(`Could not load company ${companyId} for PO document email`, err);
    return {name: ""};
  }
}

// The language outbound PO emails render in — company-wide (set on
// inventorySettings/{companyId}.poEmailLanguage by an admin/plant_manager),
// since the supplier has no app account/profile of their own to hold a
// language preference. Defaults to en-US when unset or unrecognized.
async function poEmailLanguageFor(companyId) {
  if (!companyId) return DEFAULT_LANGUAGE;
  try {
    const snap = await db.collection("inventorySettings").doc(companyId).get();
    if (!snap.exists) return DEFAULT_LANGUAGE;
    const data = snap.data() || {};
    return data.poEmailLanguage || DEFAULT_LANGUAGE;
  } catch (err) {
    logger.warn(`Could not load inventorySettings ${companyId} for PO email language`, err);
    return DEFAULT_LANGUAGE;
  }
}

function esc(s) {
  if (s == null) return "";
  return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
}

function fmtDate(ts) {
  if (!ts) return "—";
  const d = ts.toDate ? ts.toDate() : ts.seconds ? new Date(ts.seconds * 1000) : null;
  return d ? d.toLocaleDateString() : "—";
}

// Minimal white-page shell for the PO document emails — the document itself
// carries the company's name/branding in its header, so this deliberately
// skips the gradient "FirmiCore"-style hero used by brandedEmail().
function plainEmailShell(bodyHtml, companyName, strings) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#f0f4f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f0f4f8;padding:24px 12px;">
    <tr>
      <td align="center">
        <table width="680" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.07);">
          <tr>
            <td style="padding:32px;">
              ${bodyHtml}
            </td>
          </tr>
          <tr>
            <td style="background:#f8fafc;padding:16px 32px;text-align:center;border-top:1px solid #eee;">
              <p style="margin:0;color:#aaa;font-size:11px;">
                &copy; ${new Date().getFullYear()} ${esc(companyName) || esc(strings.footerFallback)}. ${esc(strings.footerCopyright)}
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

// Renders the PO as a self-contained document — company header, PO number/
// date, Supplier + Ship To cards, item table, and a Prepared/Approved by
// signature line — matching the printable PO layout used for downloads.
// `showPricing` controls whether unit cost / line total / grand total
// columns appear: false for the initial "sent" email (the supplier is the
// one who quotes cost), true for the "invoice_priced" email once the
// supplier's invoice has given us prices to confirm back to them.
function poDocumentEmailHtml(po, items, companyMeta, {showPricing, introHtml}, strings) {
  const rows = (Array.isArray(items) ? items : [])
    .map(
      (it, idx) => `
    <tr>
      <td style="padding:8px;border:1px solid #ddd;font-size:13px;">${idx + 1}</td>
      <td style="padding:8px;border:1px solid #ddd;font-size:13px;">
        <div style="font-family:ui-monospace,Menlo,monospace;color:#2563eb;font-size:12px;">${esc(it.partNumber)}</div>
        <div>${esc(it.partName)}</div>
      </td>
      <td style="padding:8px;border:1px solid #ddd;font-size:13px;text-align:right;">${it.quantityOrdered ?? ""}</td>
      <td style="padding:8px;border:1px solid #ddd;font-size:13px;">${fmtDate(it.expectedDelivery)}</td>
      ${showPricing ? `<td style="padding:8px;border:1px solid #ddd;font-size:13px;text-align:right;">${formatMoney(it.unitCost, po.currency)}</td>
      <td style="padding:8px;border:1px solid #ddd;font-size:13px;text-align:right;">${formatMoney(it.totalCost, po.currency)}</td>` : ""}
    </tr>`,
    )
    .join("");
  const total = (Array.isArray(items) ? items : []).reduce((s, it) => s + (Number(it.totalCost) || 0), 0);

  return `
  <div style="border-bottom:2px solid #111;padding-bottom:16px;margin-bottom:20px;">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="vertical-align:top;">
          <div style="font-weight:700;font-size:18px;color:#111;">${esc(companyMeta.name) || esc(strings.companyFallback)}</div>
          ${companyMeta.address ? `<div style="font-size:13px;color:#555;">${esc(companyMeta.address)}</div>` : ""}
          ${companyMeta.phone ? `<div style="font-size:13px;color:#555;">${esc(strings.phoneLabel)}: ${esc(companyMeta.phone)}</div>` : ""}
          ${companyMeta.email ? `<div style="font-size:13px;color:#555;">${esc(strings.emailLabel)}: ${esc(companyMeta.email)}</div>` : ""}
        </td>
        <td style="vertical-align:top;text-align:right;">
          <div style="font-weight:700;font-size:22px;letter-spacing:1px;color:#111;">${esc(strings.purchaseOrderHeading)}</div>
          <div style="font-family:ui-monospace,Menlo,monospace;font-weight:700;font-size:14px;color:#111;">${esc(po.poNumber)}</div>
          <div style="font-size:13px;color:#555;">${esc(strings.dateLabel)}: ${fmtDate(po.raisedAt)}</div>
        </td>
      </tr>
    </table>
  </div>

  ${introHtml || ""}

  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
    <tr>
      <td width="50%" style="vertical-align:top;padding-right:8px;">
        <div style="border:1px solid #ddd;border-radius:8px;padding:12px 14px;">
          <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.6px;color:#888;margin-bottom:6px;">${esc(strings.supplierLabel)}</div>
          <div style="font-weight:700;font-size:14px;color:#111;">${esc(po.supplierName)}</div>
          ${po.supplierContactPerson ? `<div style="font-size:13px;color:#333;">${esc(strings.attnLabel)}: ${esc(po.supplierContactPerson)}</div>` : ""}
          ${po.supplierPhone ? `<div style="font-size:13px;color:#333;">${esc(strings.phoneLabel)}: ${esc(po.supplierPhone)}</div>` : ""}
          ${po.supplierEmail ? `<div style="font-size:13px;color:#333;">${esc(strings.emailLabel)}: ${esc(po.supplierEmail)}</div>` : ""}
          ${po.supplierAddress ? `<div style="font-size:12px;color:#888;margin-top:6px;">${esc(po.supplierAddress)}</div>` : ""}
        </div>
      </td>
      <td width="50%" style="vertical-align:top;padding-left:8px;">
        <div style="border:1px solid #ddd;border-radius:8px;padding:12px 14px;">
          <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.6px;color:#888;margin-bottom:6px;">${esc(strings.shipToLabel)}</div>
          <div style="font-size:13px;color:#333;">${esc(po.deliveryAddress || companyMeta.address || companyMeta.name)}</div>
          ${po.paymentTerms ? `<div style="font-size:13px;color:#333;margin-top:6px;"><strong>${esc(strings.paymentTermsLabel)}:</strong> ${esc(po.paymentTerms)}</div>` : ""}
          <div style="font-size:13px;color:#333;margin-top:6px;"><strong>${esc(strings.currencyLabel)}:</strong> ${esc(po.currency)}</div>
        </div>
      </td>
    </tr>
  </table>

  <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
    <tr style="background:#f5f5f5;">
      <td style="padding:8px;border:1px solid #ddd;font-size:12px;text-transform:uppercase;color:#666;width:32px;">${esc(strings.colIndex)}</td>
      <td style="padding:8px;border:1px solid #ddd;font-size:12px;text-transform:uppercase;color:#666;">${esc(strings.colPart)}</td>
      <td style="padding:8px;border:1px solid #ddd;font-size:12px;text-transform:uppercase;color:#666;text-align:right;">${esc(strings.colQty)}</td>
      <td style="padding:8px;border:1px solid #ddd;font-size:12px;text-transform:uppercase;color:#666;">${esc(strings.colExpectedDelivery)}</td>
      ${showPricing ? `<td style="padding:8px;border:1px solid #ddd;font-size:12px;text-transform:uppercase;color:#666;text-align:right;">${esc(strings.colUnitCost)}</td>
      <td style="padding:8px;border:1px solid #ddd;font-size:12px;text-transform:uppercase;color:#666;text-align:right;">${esc(strings.colLineTotal)}</td>` : ""}
    </tr>
    ${rows}
  </table>

  ${showPricing ? `
  <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:10px;">
    <tr>
      <td></td>
      <td style="width:220px;border:1px solid #111;padding:10px 14px;">
        <table width="100%" cellpadding="0" cellspacing="0"><tr>
          <td style="font-size:14px;font-weight:700;">${esc(strings.totalLabel)}</td>
          <td style="font-size:14px;font-weight:700;text-align:right;">${formatMoney(total, po.currency)}</td>
        </tr></table>
      </td>
    </tr>
  </table>` : ""}

  ${po.notes ? `<div style="margin-top:16px;border:1px solid #ddd;border-radius:8px;padding:12px 14px;">
    <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.6px;color:#888;margin-bottom:6px;">${esc(strings.notesLabel)}</div>
    <div style="font-size:13px;color:#333;white-space:pre-wrap;">${esc(po.notes)}</div>
  </div>` : ""}

  <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:36px;">
    <tr>
      <td width="50%" style="border-top:1px solid #111;padding-top:6px;font-size:12px;color:#555;">
        ${esc(strings.preparedByLabel)}: ${esc(po.raisedByName)}${po.raisedByRole ? ` (${esc(po.raisedByRole)})` : ""}
      </td>
      <td width="50%" style="border-top:1px solid #111;padding-top:6px;font-size:12px;color:#555;">
        ${esc(strings.approvedByLabel)}: ${esc(po.approvedByName || "—")}${po.approvedByRole ? ` (${esc(po.approvedByRole)})` : ""}
      </td>
    </tr>
  </table>`;
}

// Received-items table (qty + condition), used for the supplier confirmation
// and the faults/damages notice. Per-item notes are always shown when
// present — not just on the issues table — so anything the receiver
// mentioned about a specific line item reaches the supplier.
const CONDITION_LABEL_KEYS = {
  good: "conditionGood",
  damaged: "conditionDamaged",
  wrong_item: "conditionWrongItem",
};

function conditionLabel(condition, strings) {
  const key = CONDITION_LABEL_KEYS[condition];
  if (key && strings[key]) return strings[key];
  return String(condition || "").replace(/_/g, " ");
}

function receivedItemsTableHtml(items, strings, {showCondition = false} = {}) {
  if (!Array.isArray(items) || items.length === 0) return "";
  const rows = items
      .map(
          (i) => `
    <tr>
      <td style="padding:6px 10px;border-bottom:1px solid #eee;font-size:13px;">${esc(i.partNumber || "")} — ${esc(i.partName || "")}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #eee;font-size:13px;text-align:right;">${i.quantity ?? ""}</td>
      ${showCondition ? `<td style="padding:6px 10px;border-bottom:1px solid #eee;font-size:13px;">${esc(conditionLabel(i.condition, strings))}${i.notes ? ` — ${esc(i.notes)}` : ""}</td>` : `<td style="padding:6px 10px;border-bottom:1px solid #eee;font-size:13px;color:#888;">${esc(i.notes || "")}</td>`}
    </tr>`,
      )
      .join("");
  return `
  <table width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;border:1px solid #eee;border-radius:8px;overflow:hidden;">
    <tr style="background:#f8fafc;">
      <td style="padding:8px 10px;font-size:12px;color:#888;">${esc(strings.colItem)}</td>
      <td style="padding:8px 10px;font-size:12px;color:#888;text-align:right;">${esc(strings.colQtyReceived)}</td>
      <td style="padding:8px 10px;font-size:12px;color:#888;">${showCondition ? esc(strings.colIssue) : esc(strings.colNotes)}</td>
    </tr>
    ${rows}
  </table>`;
}

function formatMoney(amount, currency) {
  const value = Number(amount || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });
  return `${currency || ""} ${value}`.trim();
}

exports.sendPoEmails = onDocumentCreated(
    {database: "default", document: "po_notifications/{notificationId}"},
    async (event) => {
      const notification = event.data.data();
      const {companyId, poId, poNumber, supplierName, supplierEmail, event: poEvent, message, receivedItems, issueItems, notes: deliveryNotes} = notification;
      const companyName = await companyNameFor(companyId);
      const poEmailLanguage = await poEmailLanguageFor(companyId);
      const strings = getPoEmailStrings(poEmailLanguage);
      const supplierDisplayName = esc(supplierName) || esc(strings.supplierFallback);

      // Stock receipt — thank the supplier and confirm what arrived, and (if any
      // items were flagged) send a separate faults/damages notice.
      if (poEvent === "received") {
        if (supplierEmail) {
          const goodItems = Array.isArray(receivedItems) ? receivedItems : [];
          const companyMetaReceived = await companyMetaFor(companyId);

          if (goodItems.length > 0) {
            const deliveryNotesHtml = deliveryNotes
              ? `<p style="color:#555;font-size:14px;"><strong>${esc(strings.deliveryNotesLabel)}:</strong> ${esc(String(deliveryNotes)).replace(/\n/g, "<br/>")}</p>`
              : "";
            const thankYouHtml = `
              <h2 style="margin:0 0 12px;color:#0A1628;font-size:18px;">${esc(strings.deliveryReceivedHeading)}</h2>
              <p style="color:#555;font-size:14px;">${interpolate(strings, "dearSupplier", {name: supplierDisplayName})}</p>
              <p style="color:#555;font-size:14px;">${interpolate(strings, "deliveryReceivedIntro", {poNumber: `<strong>${esc(poNumber)}</strong>`})}</p>
              ${receivedItemsTableHtml(goodItems, strings)}
              ${deliveryNotesHtml}
              <p style="color:#555;font-size:14px;">${esc(strings.deliveryReceivedClosing)}</p>
            `;
            await sendEmail({
              companyId,
              to: supplierEmail,
              subject: interpolate(strings, "subjectDeliveryReceived", {poNumber}),
              html: brandedEmail(thankYouHtml, companyName),
              fromName: companyName,
              replyTo: companyMetaReceived.email || undefined,
            });
          }

          const problems = Array.isArray(issueItems) ? issueItems : [];
          if (problems.length > 0) {
            const issueHtml = `
              <h2 style="margin:0 0 12px;color:#B91C1C;font-size:18px;">${interpolate(strings, "deliveryIssueHeading", {poNumber: esc(poNumber)})}</h2>
              <p style="color:#555;font-size:14px;">${interpolate(strings, "dearSupplier", {name: supplierDisplayName})}</p>
              <p style="color:#555;font-size:14px;">${interpolate(strings, "deliveryIssueIntro", {poNumber: `<strong>${esc(poNumber)}</strong>`})}</p>
              ${receivedItemsTableHtml(problems, strings, {showCondition: true})}
            `;
            await sendEmail({
              companyId,
              to: supplierEmail,
              subject: interpolate(strings, "subjectDeliveryIssue", {poNumber}),
              html: brandedEmail(issueHtml, companyName),
              fromName: companyName,
              replyTo: companyMetaReceived.email || undefined,
            });
          }
        }
        return;
      }

      let poData = null;
      try {
        const poSnap = await db.collection("purchaseOrders").doc(poId).get();
        if (poSnap.exists) poData = poSnap.data();
      } catch (err) {
        logger.warn(`Could not load PO ${poId} for email items table`, err);
      }
      const poItems = (poData && poData.items) || [];

      // Internal approver/admin notices are intentionally not sent — PO
      // emails go to the supplier only, never to the company's own
      // plant_manager/admin inboxes.

      // Initial supplier-facing PO email — sent as a full PO document (company
      // header, supplier/ship-to, item table) with no pricing/total, since the
      // supplier is the one who quotes cost via their invoice. Sent only once
      // the PO is actually dispatched to the supplier (the "Sent" step) —
      // never at creation/draft/pending_approval/approved, since approval is
      // an internal step the supplier has no part in.
      if (poEvent === "sent" && supplierEmail && poData) {
        const companyMeta = await companyMetaFor(companyId);
        const introHtml = `
          <p style="color:#555;font-size:14px;margin:0 0 4px;">${interpolate(strings, "dearSupplier", {name: supplierDisplayName})}</p>
          <p style="color:#555;font-size:14px;">${message ? esc(message).replace(/\n/g, "<br/>") : esc(strings.introSentDefault)}</p>
        `;
        const bodyHtml = poDocumentEmailHtml(poData, poItems, companyMeta, {showPricing: false, introHtml}, strings);
        const sent = await sendEmail({
          companyId,
          to: supplierEmail,
          subject: interpolate(strings, "subjectSent", {poNumber}),
          html: plainEmailShell(bodyHtml, companyMeta.name, strings),
          fromName: companyMeta.name,
          replyTo: companyMeta.email || undefined,
        });
        if (sent && poId) {
          await db.collection("purchaseOrders").doc(poId).update({
            supplierEmailSentAt: new Date(),
          }).catch((err) => logger.warn(`Could not stamp supplierEmailSentAt on PO ${poId}`, err));
        }
      }

      // Priced PO email — sent as the same PO document, now with the
      // supplier-invoice-derived unit costs/totals shown, once the received
      // invoice has been reviewed (accepted as-is or edited). Can fire more
      // than once for the same PO: every time the invoice is revised, a
      // fresh priced email goes out with the updated numbers.
      if (poEvent === "invoice_priced" && supplierEmail && poData) {
        const companyMeta = await companyMetaFor(companyId);
        const introHtml = `
          <p style="color:#555;font-size:14px;margin:0 0 4px;">${interpolate(strings, "dearSupplier", {name: supplierDisplayName})}</p>
          <p style="color:#555;font-size:14px;">${message ? esc(message).replace(/\n/g, "<br/>") : esc(strings.introInvoicePricedDefault)}</p>
        `;
        const bodyHtml = poDocumentEmailHtml(poData, poItems, companyMeta, {showPricing: true, introHtml}, strings);
        await sendEmail({
          companyId,
          to: supplierEmail,
          subject: interpolate(strings, "subjectInvoicePriced", {poNumber}),
          html: plainEmailShell(bodyHtml, companyMeta.name, strings),
          fromName: companyMeta.name,
          replyTo: companyMeta.email || undefined,
        });
      }

      // Cancellation notice — only fires when the PO had already been sent
      // to the supplier (queueEmail on the client only queues this event as
      // supplier-facing in that case), since a PO cancelled before dispatch
      // never reached them in the first place. Rendered as the same PO
      // document (with all the filled-in PO details) under a cancelled
      // banner, rather than a bare notice, so the supplier can see exactly
      // which order is being called off.
      if (poEvent === "cancelled" && supplierEmail && poData) {
        const companyMeta = await companyMetaFor(companyId);
        const reasonHtml = message
          ? `<p style="color:#555;font-size:14px;"><strong>${esc(strings.reasonLabel)}:</strong> ${esc(message).replace(/\n/g, "<br/>")}</p>`
          : "";
        const introHtml = `
          <div style="border:1px solid #B91C1C;background:#FEF2F2;border-radius:8px;padding:12px 14px;margin-bottom:16px;">
            <div style="font-weight:700;font-size:15px;color:#B91C1C;margin-bottom:4px;">${esc(strings.cancelledBanner)}</div>
            <p style="color:#555;font-size:14px;margin:0 0 4px;">${interpolate(strings, "dearSupplier", {name: supplierDisplayName})}</p>
            <p style="color:#555;font-size:14px;margin:0;">${esc(strings.cancelledBody)}</p>
            ${reasonHtml}
          </div>
        `;
        const bodyHtml = poDocumentEmailHtml(poData, poItems, companyMeta, {showPricing: false, introHtml}, strings);
        await sendEmail({
          companyId,
          to: supplierEmail,
          subject: interpolate(strings, "subjectCancelled", {poNumber}),
          html: plainEmailShell(bodyHtml, companyMeta.name, strings),
          fromName: companyMeta.name,
          replyTo: companyMeta.email || undefined,
        });
      }
    },
);
