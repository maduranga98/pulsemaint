/**
 * notifyLowStock
 * Firestore onUpdate trigger on companies/{companyId}/inventoryParts/{partId}
 *
 * When currentStock drops to/below minStockLevel:
 *   - Set isLowStock = true on the part doc
 *   - Send FCM to store_keeper + supervisor
 * When currentStock rises above minStockLevel (and was low):
 *   - Set isLowStock = false
 *   - Send "stock restored" notification
 */

const { onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { getFirestore } = require("firebase-admin/firestore");
const logger = require("firebase-functions/logger");
const { dispatchToRoles } = require("../lib/notificationDispatch");

const db = getFirestore("default");

// Route low-stock alerts through the shared dispatcher so each recipient's
// per-user notification preferences (push/email) are honored.
async function sendPushToRoles(companyId, roles, title, body, data = {}) {
  await dispatchToRoles(companyId, roles, "lowStock", {
    title,
    body,
    data,
    emailSubject: title,
    emailHtml: `<p>${body}</p>`,
  });
}

exports.notifyLowStock = onDocumentUpdated({ database: "default", document: "companies/{companyId}/inventoryParts/{partId}" },
  async (event) => {
    const companyId = event.params.companyId;
    const partId = event.params.partId;
    const before = event.data.before.data();
    const after = event.data.after.data();

    if (!before || !after) return;

    // Skip if currentStock didn't change
    if (before.currentStock === after.currentStock) return;

    const minStock = after.minStockLevel ?? 0;
    const partName = after.partName ?? after.name ?? partId;
    const wasLow = before.isLowStock === true || before.currentStock <= (before.minStockLevel ?? 0);
    const isNowLow = after.currentStock <= minStock;

    try {
      // Transition: normal → low
      if (!wasLow && isNowLow) {
        await event.data.after.ref.update({ isLowStock: true });

        await sendPushToRoles(
          companyId,
          ["store_keeper", "supervisor"],
          "Low Stock Alert",
          `${partName} is running low (${after.currentStock} remaining, min: ${minStock})`,
          { companyId, partId, screen: "PartDetail" },
        );

        logger.info(`Low stock alert sent for part ${partId} (qty: ${after.currentStock})`);
      }

      // Transition: low → normal (stock restored)
      if (wasLow && !isNowLow) {
        await event.data.after.ref.update({ isLowStock: false });

        await sendPushToRoles(
          companyId,
          ["store_keeper", "supervisor"],
          "Stock Restored",
          `${partName} stock is back above minimum (${after.currentStock} available)`,
          { companyId, partId, screen: "PartDetail" },
        );

        logger.info(`Stock restored notification sent for part ${partId} (qty: ${after.currentStock})`);
      }
    } catch (err) {
      logger.error(`notifyLowStock failed for ${companyId}/${partId}`, err);
    }
  },
);
