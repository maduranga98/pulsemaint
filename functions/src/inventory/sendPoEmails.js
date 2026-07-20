/**
 * sendPoEmails
 * Firestore onCreate trigger on po_notifications/{id}.
 *
 * The PO create/edit/detail screens queue a po_notifications doc whenever a
 * PO changes status, but until now nothing consumed that collection — no
 * email ever went out, to approvers or the supplier. This dispatches:
 *   - an internal notice to the queued `recipients` (plant manager / admin)
 *     for every event, and
 *   - the actual PO email to the supplier (subject + message body with the
 *     PO details) when the event is "approved" or "sent".
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
};

function formatMoney(amount, currency) {
  const value = Number(amount || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });
  return `${currency || ""} ${value}`.trim();
}

function itemsTableHtml(items) {
  if (!Array.isArray(items) || items.length === 0) return "";
  const rows = items
    .map(
      (i) => `
    <tr>
      <td style="padding:6px 10px;border-bottom:1px solid #eee;font-size:13px;">${i.partNumber || ""} — ${i.partName || ""}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #eee;font-size:13px;text-align:right;">${i.quantityOrdered ?? ""}</td>
    </tr>`,
    )
    .join("");
  return `
  <table width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;border:1px solid #eee;border-radius:8px;overflow:hidden;">
    <tr style="background:#f8fafc;">
      <td style="padding:8px 10px;font-size:12px;color:#888;">Item</td>
      <td style="padding:8px 10px;font-size:12px;color:#888;text-align:right;">Qty</td>
    </tr>
    ${rows}
  </table>`;
}

exports.sendPoEmails = onDocumentCreated(
    {database: "default", document: "po_notifications/{notificationId}"},
    async (event) => {
      const notification = event.data.data();
      const {poId, poNumber, supplierName, supplierEmail, total, currency, recipients, event: poEvent, message} = notification;
      const label = EVENT_LABELS[poEvent] || poEvent;

      let poItems = [];
      try {
        const poSnap = await db.collection("purchaseOrders").doc(poId).get();
        if (poSnap.exists) poItems = poSnap.data().items || [];
      } catch (err) {
        logger.warn(`Could not load PO ${poId} for email items table`, err);
      }

      // Internal approvers/admins.
      if (Array.isArray(recipients) && recipients.length > 0) {
        const bodyHtml = `
          <h2 style="margin:0 0 12px;color:#0A1628;font-size:18px;">Purchase Order ${label}</h2>
          <p style="color:#555;font-size:14px;">PO <strong>${poNumber}</strong> to <strong>${supplierName}</strong> (${formatMoney(total, currency)}) was ${label}.</p>
          ${itemsTableHtml(poItems)}
        `;
        await Promise.all(
            recipients.map((to) =>
              sendEmail({
                to,
                subject: `PO ${poNumber} ${label}`,
                html: brandedEmail(bodyHtml),
              }),
            ),
        );
      }

      // Supplier-facing email — only once the PO is actually approved/sent.
      if ((poEvent === "approved" || poEvent === "sent") && supplierEmail) {
        const bodyHtml = `
          <h2 style="margin:0 0 12px;color:#0A1628;font-size:18px;">Purchase Order ${poNumber}</h2>
          <p style="color:#555;font-size:14px;">Dear ${supplierName || "Supplier"},</p>
          <p style="color:#555;font-size:14px;">${message ? message.replace(/\n/g, "<br/>") : `Please find our purchase order below. Total value: ${formatMoney(total, currency)}.`}</p>
          ${itemsTableHtml(poItems)}
          <p style="color:#555;font-size:14px;">Please confirm receipt of this order and the expected delivery date.</p>
        `;
        const sent = await sendEmail({
          to: supplierEmail,
          subject: `Purchase Order ${poNumber}`,
          html: brandedEmail(bodyHtml),
        });
        if (sent && poId) {
          await db.collection("purchaseOrders").doc(poId).update({
            supplierEmailSentAt: new Date(),
          }).catch((err) => logger.warn(`Could not stamp supplierEmailSentAt on PO ${poId}`, err));
        }
      }
    },
);
