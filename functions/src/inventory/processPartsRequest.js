/**
 * processPartsRequest
 * Firestore onCreate trigger on companies/{companyId}/partsRequests/{requestId}
 *
 * 1. Fetch inventorySettings for the company
 * 2. Check if any requested item is marked critical
 * 3. If cost <= autoApproveThreshold AND no critical items: notify Store Keeper only
 * 4. Always send FCM to all store_keeper users in the company
 * 5. If priorityLevel === 'critical': also notify supervisors
 */

const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");
const logger = require("firebase-functions/logger");

const db = getFirestore();

async function sendPushToRoleInCompany(companyId, role, title, body, data = {}) {
  const usersSnap = await db
    .collection("users")
    .where("companyId", "==", companyId)
    .where("role", "==", role)
    .get();

  const tokens = [];
  for (const doc of usersSnap.docs) {
    const token = doc.data().fcmToken;
    if (token) tokens.push(token);
  }

  if (!tokens.length) return;

  try {
    await getMessaging().sendEachForMulticast({
      tokens,
      notification: { title, body },
      data,
    });
  } catch (err) {
    logger.error(`FCM multicast failed for role=${role}`, err);
  }
}

exports.processPartsRequest = onDocumentCreated(
  "companies/{companyId}/partsRequests/{requestId}",
  async (event) => {
    const companyId = event.params.companyId;
    const requestId = event.params.requestId;
    const request = event.data.data();

    try {
      // Fetch inventorySettings
      const settingsSnap = await db
        .collection("companies")
        .doc(companyId)
        .collection("inventorySettings")
        .limit(1)
        .get();

      const settings = settingsSnap.empty ? {} : settingsSnap.docs[0].data();
      const autoApproveThreshold = settings.autoApproveThreshold ?? 500;

      // Check if any item is critical
      const items = request.items ?? [];
      let hasCriticalItem = false;

      for (const item of items) {
        if (item.partId) {
          const partDoc = await db
            .collection("companies")
            .doc(companyId)
            .collection("inventoryParts")
            .doc(item.partId)
            .get();
          if (partDoc.exists && partDoc.data().isCritical) {
            hasCriticalItem = true;
            break;
          }
        }
      }

      const totalCost = request.totalEstimatedCost ?? 0;
      const priorityLevel = request.priorityLevel ?? "normal";

      const title = "New Parts Request";
      const body = `Request #${requestId.slice(-6).toUpperCase()} — ${items.length} item(s), est. cost: ${totalCost}`;
      const data = { companyId, requestId, screen: "PartsRequestDetail" };

      // Always notify store keepers
      await sendPushToRoleInCompany(companyId, "store_keeper", title, body, data);

      // Notify supervisors if critical priority or critical part
      if (priorityLevel === "critical" || hasCriticalItem) {
        await sendPushToRoleInCompany(
          companyId,
          "supervisor",
          "⚠️ Critical Parts Request",
          `Urgent: ${body}`,
          data,
        );
      }

      // If cost exceeds threshold or critical, escalate to plant_manager
      if (totalCost > autoApproveThreshold || hasCriticalItem) {
        await sendPushToRoleInCompany(
          companyId,
          "plant_manager",
          "Parts Request Requires Approval",
          body,
          data,
        );
      }

      logger.info(`processPartsRequest: handled ${requestId} for company ${companyId}`);
    } catch (err) {
      logger.error(`processPartsRequest failed for ${companyId}/${requestId}`, err);
    }
  },
);
