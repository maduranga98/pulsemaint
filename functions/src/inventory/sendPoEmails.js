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
function plainEmailShell(bodyHtml, companyName) {
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
                &copy; ${new Date().getFullYear()} ${esc(companyName) || "Purchase Order"}. All rights reserved.
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
function poDocumentEmailHtml(po, items, companyMeta, {showPricing, introHtml}) {
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
          <div style="font-weight:700;font-size:18px;color:#111;">${esc(companyMeta.name) || "Company"}</div>
          ${companyMeta.address ? `<div style="font-size:13px;color:#555;">${esc(companyMeta.address)}</div>` : ""}
          ${companyMeta.phone ? `<div style="font-size:13px;color:#555;">Phone: ${esc(companyMeta.phone)}</div>` : ""}
          ${companyMeta.email ? `<div style="font-size:13px;color:#555;">Email: ${esc(companyMeta.email)}</div>` : ""}
        </td>
        <td style="vertical-align:top;text-align:right;">
          <div style="font-weight:700;font-size:22px;letter-spacing:1px;color:#111;">PURCHASE ORDER</div>
          <div style="font-family:ui-monospace,Menlo,monospace;font-weight:700;font-size:14px;color:#111;">${esc(po.poNumber)}</div>
          <div style="font-size:13px;color:#555;">Date: ${fmtDate(po.raisedAt)}</div>
        </td>
      </tr>
    </table>
  </div>

  ${introHtml || ""}

  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
    <tr>
      <td width="50%" style="vertical-align:top;padding-right:8px;">
        <div style="border:1px solid #ddd;border-radius:8px;padding:12px 14px;">
          <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.6px;color:#888;margin-bottom:6px;">Supplier</div>
          <div style="font-weight:700;font-size:14px;color:#111;">${esc(po.supplierName)}</div>
          ${po.supplierContactPerson ? `<div style="font-size:13px;color:#333;">Attn: ${esc(po.supplierContactPerson)}</div>` : ""}
          ${po.supplierPhone ? `<div style="font-size:13px;color:#333;">Phone: ${esc(po.supplierPhone)}</div>` : ""}
          ${po.supplierEmail ? `<div style="font-size:13px;color:#333;">Email: ${esc(po.supplierEmail)}</div>` : ""}
          ${po.supplierAddress ? `<div style="font-size:12px;color:#888;margin-top:6px;">${esc(po.supplierAddress)}</div>` : ""}
        </div>
      </td>
      <td width="50%" style="vertical-align:top;padding-left:8px;">
        <div style="border:1px solid #ddd;border-radius:8px;padding:12px 14px;">
          <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.6px;color:#888;margin-bottom:6px;">Ship To</div>
          <div style="font-size:13px;color:#333;">${esc(po.deliveryAddress || companyMeta.address || companyMeta.name)}</div>
          ${po.paymentTerms ? `<div style="font-size:13px;color:#333;margin-top:6px;"><strong>Payment Terms:</strong> ${esc(po.paymentTerms)}</div>` : ""}
          <div style="font-size:13px;color:#333;margin-top:6px;"><strong>Currency:</strong> ${esc(po.currency)}</div>
        </div>
      </td>
    </tr>
  </table>

  <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
    <tr style="background:#f5f5f5;">
      <td style="padding:8px;border:1px solid #ddd;font-size:12px;text-transform:uppercase;color:#666;width:32px;">#</td>
      <td style="padding:8px;border:1px solid #ddd;font-size:12px;text-transform:uppercase;color:#666;">Part</td>
      <td style="padding:8px;border:1px solid #ddd;font-size:12px;text-transform:uppercase;color:#666;text-align:right;">Qty</td>
      <td style="padding:8px;border:1px solid #ddd;font-size:12px;text-transform:uppercase;color:#666;">Expected Delivery</td>
      ${showPricing ? `<td style="padding:8px;border:1px solid #ddd;font-size:12px;text-transform:uppercase;color:#666;text-align:right;">Unit Cost</td>
      <td style="padding:8px;border:1px solid #ddd;font-size:12px;text-transform:uppercase;color:#666;text-align:right;">Line Total</td>` : ""}
    </tr>
    ${rows}
  </table>

  ${showPricing ? `
  <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:10px;">
    <tr>
      <td></td>
      <td style="width:220px;border:1px solid #111;padding:10px 14px;">
        <table width="100%" cellpadding="0" cellspacing="0"><tr>
          <td style="font-size:14px;font-weight:700;">Total</td>
          <td style="font-size:14px;font-weight:700;text-align:right;">${formatMoney(total, po.currency)}</td>
        </tr></table>
      </td>
    </tr>
  </table>` : ""}

  ${po.notes ? `<div style="margin-top:16px;border:1px solid #ddd;border-radius:8px;padding:12px 14px;">
    <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.6px;color:#888;margin-bottom:6px;">Notes</div>
    <div style="font-size:13px;color:#333;white-space:pre-wrap;">${esc(po.notes)}</div>
  </div>` : ""}

  <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:36px;">
    <tr>
      <td width="50%" style="border-top:1px solid #111;padding-top:6px;font-size:12px;color:#555;">
        Prepared by: ${esc(po.raisedByName)}${po.raisedByRole ? ` (${esc(po.raisedByRole)})` : ""}
      </td>
      <td width="50%" style="border-top:1px solid #111;padding-top:6px;font-size:12px;color:#555;">
        Approved by: ${esc(po.approvedByName || "—")}${po.approvedByRole ? ` (${esc(po.approvedByRole)})` : ""}
      </td>
    </tr>
  </table>`;
}

// Received-items table (qty + condition), used for the supplier confirmation
// and the faults/damages notice. Per-item notes are always shown when
// present — not just on the issues table — so anything the receiver
// mentioned about a specific line item reaches the supplier.
function receivedItemsTableHtml(items, {showCondition = false} = {}) {
  if (!Array.isArray(items) || items.length === 0) return "";
  const rows = items
      .map(
          (i) => `
    <tr>
      <td style="padding:6px 10px;border-bottom:1px solid #eee;font-size:13px;">${i.partNumber || ""} — ${i.partName || ""}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #eee;font-size:13px;text-align:right;">${i.quantity ?? ""}</td>
      ${showCondition ? `<td style="padding:6px 10px;border-bottom:1px solid #eee;font-size:13px;">${String(i.condition || "").replace(/_/g, " ")}${i.notes ? ` — ${i.notes}` : ""}</td>` : `<td style="padding:6px 10px;border-bottom:1px solid #eee;font-size:13px;color:#888;">${i.notes || ""}</td>`}
    </tr>`,
      )
      .join("");
  return `
  <table width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;border:1px solid #eee;border-radius:8px;overflow:hidden;">
    <tr style="background:#f8fafc;">
      <td style="padding:8px 10px;font-size:12px;color:#888;">Item</td>
      <td style="padding:8px 10px;font-size:12px;color:#888;text-align:right;">Qty received</td>
      <td style="padding:8px 10px;font-size:12px;color:#888;">${showCondition ? "Issue" : "Notes"}</td>
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

      // Stock receipt — thank the supplier and confirm what arrived, and (if any
      // items were flagged) send a separate faults/damages notice.
      if (poEvent === "received") {
        if (supplierEmail) {
          const goodItems = Array.isArray(receivedItems) ? receivedItems : [];
          const deliveryNotesHtml = deliveryNotes
            ? `<p style="color:#555;font-size:14px;"><strong>Delivery notes:</strong> ${String(deliveryNotes).replace(/\n/g, "<br/>")}</p>`
            : "";
          const thankYouHtml = `
            <h2 style="margin:0 0 12px;color:#0A1628;font-size:18px;">Delivery received — thank you</h2>
            <p style="color:#555;font-size:14px;">Dear ${supplierName || "Supplier"},</p>
            <p style="color:#555;font-size:14px;">Thank you for your delivery against purchase order <strong>${poNumber}</strong>. We have received the following items:</p>
            ${receivedItemsTableHtml(goodItems)}
            ${deliveryNotesHtml}
            <p style="color:#555;font-size:14px;">We appreciate your continued partnership.</p>
          `;
          const companyMetaReceived = await companyMetaFor(companyId);
          await sendEmail({
            companyId,
            to: supplierEmail,
            subject: `Delivery received — PO ${poNumber}`,
            html: brandedEmail(thankYouHtml, companyName),
            fromName: companyName,
            replyTo: companyMetaReceived.email || undefined,
          });

          const problems = Array.isArray(issueItems) ? issueItems : [];
          if (problems.length > 0) {
            const issueHtml = `
              <h2 style="margin:0 0 12px;color:#B91C1C;font-size:18px;">Issue with delivery — PO ${poNumber}</h2>
              <p style="color:#555;font-size:14px;">Dear ${supplierName || "Supplier"},</p>
              <p style="color:#555;font-size:14px;">While receiving purchase order <strong>${poNumber}</strong> we found the following items damaged or incorrect. Please advise on a replacement or credit:</p>
              ${receivedItemsTableHtml(problems, {showCondition: true})}
            `;
            await sendEmail({
              companyId,
              to: supplierEmail,
              subject: `Issue with delivery — PO ${poNumber}`,
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
          <p style="color:#555;font-size:14px;margin:0 0 4px;">Dear ${esc(supplierName) || "Supplier"},</p>
          <p style="color:#555;font-size:14px;">${message ? esc(message).replace(/\n/g, "<br/>") : "Please find our purchase order below. Kindly confirm receipt and send your invoice with pricing for our review."}</p>
        `;
        const bodyHtml = poDocumentEmailHtml(poData, poItems, companyMeta, {showPricing: false, introHtml});
        const sent = await sendEmail({
          companyId,
          to: supplierEmail,
          subject: `Purchase Order ${poNumber}`,
          html: plainEmailShell(bodyHtml, companyMeta.name),
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
          <p style="color:#555;font-size:14px;margin:0 0 4px;">Dear ${esc(supplierName) || "Supplier"},</p>
          <p style="color:#555;font-size:14px;">${message ? esc(message).replace(/\n/g, "<br/>") : "Thank you for your invoice. Here is the suggested pricing based on it — please confirm."}</p>
        `;
        const bodyHtml = poDocumentEmailHtml(poData, poItems, companyMeta, {showPricing: true, introHtml});
        await sendEmail({
          companyId,
          to: supplierEmail,
          subject: `Purchase Order ${poNumber} — suggested pricing per invoice`,
          html: plainEmailShell(bodyHtml, companyMeta.name),
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
          ? `<p style="color:#555;font-size:14px;"><strong>Reason:</strong> ${esc(message).replace(/\n/g, "<br/>")}</p>`
          : "";
        const introHtml = `
          <div style="border:1px solid #B91C1C;background:#FEF2F2;border-radius:8px;padding:12px 14px;margin-bottom:16px;">
            <div style="font-weight:700;font-size:15px;color:#B91C1C;margin-bottom:4px;">CANCELLED</div>
            <p style="color:#555;font-size:14px;margin:0 0 4px;">Dear ${esc(supplierName) || "Supplier"},</p>
            <p style="color:#555;font-size:14px;margin:0;">This purchase order, previously sent to you, has been cancelled. Please stop any preparation or shipment against it.</p>
            ${reasonHtml}
          </div>
        `;
        const bodyHtml = poDocumentEmailHtml(poData, poItems, companyMeta, {showPricing: false, introHtml});
        await sendEmail({
          companyId,
          to: supplierEmail,
          subject: `Purchase Order ${poNumber} — cancelled`,
          html: plainEmailShell(bodyHtml, companyMeta.name),
          fromName: companyMeta.name,
          replyTo: companyMeta.email || undefined,
        });
      }
    },
);
