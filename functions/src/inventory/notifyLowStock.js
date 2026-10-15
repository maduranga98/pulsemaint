/**
 * notifyLowStock
 * Firestore onUpdate trigger on inventoryParts/{partId} (top-level — parts
 * carry their companyId; the old companies/{companyId}/inventoryParts path
 * never matched a real document, so this never fired)
 *
 * When currentStock drops to/below minStockLevel:
 *   - Set isLowStock = true on the part doc
 *   - Send FCM to store_keeper + supervisor
 * When currentStock rises above minStockLevel (and was low):
 *   - Set isLowStock = false
 *   - Send "stock restored" notification
 */

const { onDocumentUpdated, onDocumentCreated } = require("firebase-functions/v2/firestore");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");
const logger = require("firebase-functions/logger");
const { companyHasFeature } = require("../lib/planFeatures");

const db = getFirestore("default");

async function sendPushToRoles(companyId, roles, title, body, data = {}) {
  // Low-stock alerts are a Workshop-and-up feature (or free during a trial).
  if (!(await companyHasFeature(companyId, "qrLowStockAlerts"))) return;
  const tokens = [];
  for (const role of roles) {
    const snap = await db
      .collection("users")
      .where("companyId", "==", companyId)
      .where("role", "==", role)
      .get();
    for (const doc of snap.docs) {
      const token = doc.data().fcmToken;
      if (token) tokens.push(token);
    }
  }

  if (!tokens.length) return;

  try {
    await getMessaging().sendEachForMulticast({
      tokens,
      notification: { title, body },
      data,
    });
  } catch (err) {
    logger.error("FCM low-stock notification failed", err);
  }
}

// A part linked to machines is those machines' spare part: tell the store
// keeper (in the bell) which machines are affected. Admin/plant manager are
// copied, but the client only shows them that copy when it is out of stock.
async function notifySpareLow(companyId, partId, part) {
  const machineIds = Array.isArray(part.compatibleMachineIds) ? part.compatibleMachineIds : [];
  if (machineIds.length === 0) return;
  const names = [];
  for (const id of machineIds.slice(0, 5)) {
    const m = await db.collection("machines").doc(String(id)).get();
    if (m.exists) names.push(m.data().name || id);
  }
  if (names.length === 0) return;
  const out = (part.currentStock ?? 0) <= 0;
  const partName = part.partName || part.name || partId;
  const more = machineIds.length > names.length ? ` +${machineIds.length - names.length} more` : "";
  await db.collection("notifications").add({
    companyId,
    type: "parts",
    message: `Spare part ${out ? "out of stock" : "running low"}: ${partName} (${part.currentStock ?? 0} left, min ${part.minStockLevel ?? 0}) — for ${names.join(", ")}${more}`,
    severity: out ? "high" : "medium",
    linkTo: `/app/inventory/catalog/${partId}`,
    timestamp: FieldValue.serverTimestamp(),
    read: false,
    readBy: [],
    recipientRoles: ["store_keeper", "admin", "plant_manager"],
    recipientUserIds: [],
    targetRoles: ["store_keeper"],
    targetUserIds: [],
    actorName: null,
    actorRole: null,
    actorUserId: null,
    oversightMessage: null,
    plantId: part.plantId || null,
    department: null,
  });
}

// A new part that is already at/below its reorder level (e.g. added as a
// machine spare part with stock under the minimum).
exports.notifyLowStockOnCreate = onDocumentCreated({ database: "default", document: "inventoryParts/{partId}" },
  async (event) => {
    const part = event.data.data();
    if (!part || !part.companyId) return;
    const min = part.minStockLevel ?? 0;
    if (min > 0 && (part.currentStock ?? 0) <= min) {
      try {
        await notifySpareLow(part.companyId, event.params.partId, part);
      } catch (err) {
        logger.error(`notifyLowStockOnCreate failed for ${event.params.partId}`, err);
      }
    }
  },
);

exports.notifyLowStock = onDocumentUpdated({ database: "default", document: "inventoryParts/{partId}" },
  async (event) => {
    const partId = event.params.partId;
    const before = event.data.before.data();
    const after = event.data.after.data();

    if (!before || !after) return;
    const companyId = after.companyId;
    if (!companyId) return;

    // Skip unless the stock changed or the part was just linked to a machine
    // (which can make an already-low part someone's spare part).
    const beforeLinks = Array.isArray(before.compatibleMachineIds) ? before.compatibleMachineIds : [];
    const afterLinks = Array.isArray(after.compatibleMachineIds) ? after.compatibleMachineIds : [];
    const newlyLinked = afterLinks.some((id) => !beforeLinks.includes(id));
    if (before.currentStock === after.currentStock) {
      const min = after.minStockLevel ?? 0;
      if (newlyLinked && min > 0 && after.currentStock <= min) {
        try {
          await notifySpareLow(companyId, partId, after);
        } catch (err) {
          logger.error(`notifySpareLow (linked) failed for ${partId}`, err);
        }
      }
      return;
    }

    const minStock = after.minStockLevel ?? 0;
    const partName = after.partName ?? after.name ?? partId;
    const wasLow = before.isLowStock === true || before.currentStock <= (before.minStockLevel ?? 0);
    const isNowLow = after.currentStock <= minStock;

    try {
      // Transition: normal → low
      if (!wasLow && isNowLow) {
        await event.data.after.ref.update({ isLowStock: true });

        try {
          await notifySpareLow(companyId, partId, after);
        } catch (err) {
          logger.error(`notifySpareLow failed for ${partId}`, err);
        }

        await sendPushToRoles(
          companyId,
          ["store_keeper", "supervisor"],
          "Low Stock Alert",
          `${partName} is running low (${after.currentStock} remaining, min: ${minStock})`,
          { companyId, partId, screen: "PartDetail" },
        );

        logger.info(`Low stock alert sent for part ${partId} (qty: ${after.currentStock})`);
      }

      // Already low, now completely out — escalate for machine spare parts.
      if (wasLow && isNowLow && before.currentStock > 0 && after.currentStock <= 0) {
        try {
          await notifySpareLow(companyId, partId, after);
        } catch (err) {
          logger.error(`notifySpareLow (out) failed for ${partId}`, err);
        }
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
