/**
 * sendPoEmails
 * Firestore onCreate trigger on po_notifications/{id}.
 *
 * The PO create/edit/detail screens queue a po_notifications doc whenever a
 * PO changes status, but until now nothing consumed that collection — no
 * email ever went out, to approvers or the supplier. This dispatches:
 *   - an internal notice to the queued `recipients` (plant manager / admin)
 *     for every event,
 *   - the initial PO email to the supplier (no prices — the supplier is the
 *     one who quotes/sends prices via their invoice) when the event is
 *     "sent" (i.e. actually dispatched to the supplier, not just approved),
 *   - a priced PO email once the received invoice has been reviewed
 *     (accepted as-is or edited) — event "invoice_priced",
 *   - the delivery receipt confirmation once stock is received, and
 *   - a cancellation notice, with the reason given, when a PO that had
 *     already been sent to the supplier is cancelled — event "cancelled".
 * Every supplier-facing email is branded with the tenant's own company name
 * instead of the generic "PulseMaint" platform name.
 */

const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { getFirestore } = require("firebase-admin/firestore");
const logger = require("firebase-functions/logger");
const { brandedEmail, sendEmail } = require("../lib/mailer");

const db = getFirestore("default");

const EVENT_LABELS = {
  pending_approval: "submitted for approval",
  approved: "approved",
  sent: "sent to supplier",
  rejected: "rejected",
  invoice_received: "invoice received",
  invoice_priced: "priced after invoice review",
  acknowledged: "acknowledged",
  received: "received",
  cancelled: "cancelled",
};

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

// Items table for the initial PO email — Part + Qty only. No prices: the
// supplier is the one who quotes cost, via the invoice they send back.
function itemsTableHtmlNoPrice(items) {
  if (!Array.isArray(items) || items.length === 0) return "";
  const rows = items
    .map(
      (i, idx) => `
    <tr>
      <td style="padding:6px 10px;border-bottom:1px solid #eee;font-size:13px;">${idx + 1}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #eee;font-size:13px;">${i.partNumber || ""} — ${i.partName || ""}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #eee;font-size:13px;text-align:right;">${i.quantityOrdered ?? ""}</td>
    </tr>`,
    )
    .join("");
  return `
  <table width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;border:1px solid #eee;border-radius:8px;overflow:hidden;">
    <tr style="background:#f8fafc;">
      <td style="padding:8px 10px;font-size:12px;color:#888;width:32px;">#</td>
      <td style="padding:8px 10px;font-size:12px;color:#888;">Part</td>
      <td style="padding:8px 10px;font-size:12px;color:#888;text-align:right;">Qty</td>
    </tr>
    ${rows}
  </table>`;
}

// Priced items table (matches the printable PO layout: #, Part, Qty, Unit
// Cost, Line Total, plus a Subtotal/Total box) — used once prices are known
// from the supplier's invoice.
function itemsTableHtmlPriced(items, currency) {
  if (!Array.isArray(items) || items.length === 0) return "";
  const rows = items
    .map(
      (i, idx) => `
    <tr>
      <td style="padding:6px 10px;border-bottom:1px solid #eee;font-size:13px;">${idx + 1}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #eee;font-size:13px;">${i.partNumber || ""} — ${i.partName || ""}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #eee;font-size:13px;text-align:right;">${i.quantityOrdered ?? ""}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #eee;font-size:13px;text-align:right;">${formatMoney(i.unitCost, currency)}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #eee;font-size:13px;text-align:right;">${formatMoney(i.totalCost, currency)}</td>
    </tr>`,
    )
    .join("");
  const total = items.reduce((sum, i) => sum + (Number(i.totalCost) || 0), 0);
  return `
  <table width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;border:1px solid #eee;border-radius:8px;overflow:hidden;">
    <tr style="background:#f8fafc;">
      <td style="padding:8px 10px;font-size:12px;color:#888;width:32px;">#</td>
      <td style="padding:8px 10px;font-size:12px;color:#888;">Part</td>
      <td style="padding:8px 10px;font-size:12px;color:#888;text-align:right;">Qty</td>
      <td style="padding:8px 10px;font-size:12px;color:#888;text-align:right;">Unit Cost</td>
      <td style="padding:8px 10px;font-size:12px;color:#888;text-align:right;">Line Total</td>
    </tr>
    ${rows}
  </table>
  <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px;">
    <tr>
      <td></td>
      <td style="width:220px;border:1px solid #111;padding:10px 14px;">
        <div style="display:flex;justify-content:space-between;font-size:14px;font-weight:700;">
          <span>Total</span><span>${formatMoney(total, currency)}</span>
        </div>
      </td>
    </tr>
  </table>`;
}

exports.sendPoEmails = onDocumentCreated(
    {database: "default", document: "po_notifications/{notificationId}"},
    async (event) => {
      const notification = event.data.data();
      const {companyId, poId, poNumber, supplierName, supplierEmail, total, currency, recipients, event: poEvent, message, receivedItems, issueItems, notes: deliveryNotes} = notification;
      const label = EVENT_LABELS[poEvent] || poEvent;
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
          await sendEmail({
            to: supplierEmail,
            subject: `Delivery received — PO ${poNumber}`,
            html: brandedEmail(thankYouHtml, companyName),
            fromName: companyName,
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
              to: supplierEmail,
              subject: `Issue with delivery — PO ${poNumber}`,
              html: brandedEmail(issueHtml, companyName),
              fromName: companyName,
            });
          }
        }
        return;
      }

      let poItems = [];
      try {
        const poSnap = await db.collection("purchaseOrders").doc(poId).get();
        if (poSnap.exists) poItems = poSnap.data().items || [];
      } catch (err) {
        logger.warn(`Could not load PO ${poId} for email items table`, err);
      }

      // Internal approvers/admins — this internal notice can show prices,
      // it never goes to the supplier. Exclude the supplier's own address
      // (e.g. a plant manager who is also listed as the supplier contact)
      // so that inbox never gets both this and the supplier-facing email
      // below for the same event.
      const supplierEmailLower = (supplierEmail || "").trim().toLowerCase();
      const internalRecipients = (Array.isArray(recipients) ? recipients : []).filter(
          (to) => (to || "").trim().toLowerCase() !== supplierEmailLower,
      );
      if (internalRecipients.length > 0) {
        const bodyHtml = `
          <h2 style="margin:0 0 12px;color:#0A1628;font-size:18px;">Purchase Order ${label}</h2>
          <p style="color:#555;font-size:14px;">PO <strong>${poNumber}</strong> to <strong>${supplierName}</strong> (${formatMoney(total, currency)}) was ${label}.</p>
          ${itemsTableHtmlPriced(poItems, currency)}
        `;
        await Promise.all(
            internalRecipients.map((to) =>
              sendEmail({
                to,
                subject: `PO ${poNumber} ${label}`,
                html: brandedEmail(bodyHtml, companyName),
                fromName: companyName,
              }),
            ),
        );
      }

      // Initial supplier-facing PO email — no prices, since the supplier is
      // the one who quotes cost via their invoice. Sent only once the PO is
      // actually dispatched to the supplier (the "Sent" step) — never at
      // creation/draft/pending_approval/approved, since approval is an
      // internal step the supplier has no part in.
      if (poEvent === "sent" && supplierEmail) {
        const bodyHtml = `
          <h2 style="margin:0 0 12px;color:#0A1628;font-size:18px;">Purchase Order ${poNumber}</h2>
          <p style="color:#555;font-size:14px;">Dear ${supplierName || "Supplier"},</p>
          <p style="color:#555;font-size:14px;">${message ? message.replace(/\n/g, "<br/>") : "Please find our purchase order below."}</p>
          ${itemsTableHtmlNoPrice(poItems)}
          <p style="color:#555;font-size:14px;">Please confirm receipt of this order and send your invoice with pricing for our review.</p>
        `;
        const sent = await sendEmail({
          to: supplierEmail,
          subject: `Purchase Order ${poNumber}`,
          html: brandedEmail(bodyHtml, companyName),
          fromName: companyName,
        });
        if (sent && poId) {
          await db.collection("purchaseOrders").doc(poId).update({
            supplierEmailSentAt: new Date(),
          }).catch((err) => logger.warn(`Could not stamp supplierEmailSentAt on PO ${poId}`, err));
        }
      }

      // Priced PO email — sent once the received invoice has been reviewed
      // (accepted as-is or edited). Includes the final unit costs/totals, so
      // this is the one email in the flow that does carry prices. Can fire
      // more than once for the same PO: every time the invoice is revised,
      // a fresh priced email goes out with the updated numbers.
      if (poEvent === "invoice_priced" && supplierEmail) {
        const bodyHtml = `
          <h2 style="margin:0 0 12px;color:#0A1628;font-size:18px;">Purchase Order ${poNumber} — priced per invoice</h2>
          <p style="color:#555;font-size:14px;">Dear ${supplierName || "Supplier"},</p>
          <p style="color:#555;font-size:14px;">${message ? message.replace(/\n/g, "<br/>") : `Thank you for your invoice. Here is the finalized purchase order, total value ${formatMoney(total, currency)}.`}</p>
          ${itemsTableHtmlPriced(poItems, currency)}
        `;
        await sendEmail({
          to: supplierEmail,
          subject: `Purchase Order ${poNumber} — priced per invoice`,
          html: brandedEmail(bodyHtml, companyName),
          fromName: companyName,
        });
      }

      // Cancellation notice — only fires when the PO had already been sent
      // to the supplier (queueEmail on the client only queues this event as
      // supplier-facing in that case), since a PO cancelled before dispatch
      // never reached them in the first place.
      if (poEvent === "cancelled" && supplierEmail) {
        const reasonHtml = message
          ? `<p style="color:#555;font-size:14px;"><strong>Reason:</strong> ${String(message).replace(/\n/g, "<br/>")}</p>`
          : "";
        const bodyHtml = `
          <h2 style="margin:0 0 12px;color:#B91C1C;font-size:18px;">Purchase Order ${poNumber} — cancelled</h2>
          <p style="color:#555;font-size:14px;">Dear ${supplierName || "Supplier"},</p>
          <p style="color:#555;font-size:14px;">Purchase order <strong>${poNumber}</strong>, previously sent to you, has been cancelled. Please stop any preparation or shipment against it.</p>
          ${reasonHtml}
          <p style="color:#555;font-size:14px;">We apologize for any inconvenience. Please reach out if you have already incurred costs against this order.</p>
        `;
        await sendEmail({
          to: supplierEmail,
          subject: `Purchase Order ${poNumber} — cancelled`,
          html: brandedEmail(bodyHtml, companyName),
          fromName: companyName,
        });
      }
    },
);
